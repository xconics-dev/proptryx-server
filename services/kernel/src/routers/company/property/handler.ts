import type { AppBindings } from "@/types/app";
import { logger } from "@/lib/logger";
import { deleteUploadObjects } from "@/lib/object-storage";
import { OpenAPIHono } from "@hono/zod-openapi";
import {
  db,
  DATABASE_RESOURCES,
  checkOrganizationLimit,
  member,
  property,
  propertyMedia,
  propertyOwner,
  propertyZone,
  user,
} from "@proptryx/database";
import { sendPropertyPublishedNotificationEmails } from "@proptryx/notification";
import {
  buildOrganizationLimitDeniedMessage,
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  getPermissionAccessLevel,
  hasPermission,
  registerOpenApiRoute,
} from "@proptryx/utils";
import { and, eq } from "drizzle-orm";
import { create, get, list, remove, removePermanently, restore, update } from "./openapi.route";
import { fetchPropertyList } from "./list";
import {
  attachPropertyRelations,
  findPropertyById,
  findPropertyByIdWithRelations,
  getValidatedCoOwnerIdsFromOwnerTerms,
  getDerivedPropertyFields,
  mergePropertyOwnerTermsWithExisting,
  normalizePropertyOwnerTerms,
  replacePropertyMediaItems,
  replacePropertyTemporaryOwnerTerms,
  replacePropertyTypeDetails,
  stripUndefinedFields,
  validateKernelPropertyReferences,
} from "./utils";

export const kernelCompanyPropertyGroup = new OpenAPIHono<AppBindings>();
const E_MANDATE_MEDIA_ALT_TEXT = "E_MANDATE";
const E_MANDATE_MEDIA_NAME = "E-Mandate";

function getCompanyPanelOrganizationId(c: Parameters<typeof getBetterAuthContext>[0]) {
  const authContext = getBetterAuthContext(c);
  const panel = authContext.authorization.panel ?? authContext.user?.panel ?? null;

  return panel === "company" ? (authContext.session?.activeOrganizationId ?? null) : null;
}

function isProptryxBrokerUser(c: Parameters<typeof getBetterAuthContext>[0]) {
  const authContext = getBetterAuthContext(c);
  const role = authContext.authorization.role ?? authContext.user?.role ?? null;
  const panel = authContext.authorization.panel ?? authContext.user?.panel ?? null;

  return panel === "proptryx" && role?.trim().toLowerCase() === "broker";
}

function getPropertyAccessLevel(c: Parameters<typeof getBetterAuthContext>[0]) {
  return getPermissionAccessLevel(getBetterAuthContext(c), DATABASE_RESOURCES.property);
}

function getPropertyUpdatePermissionError({
  authContext,
  existingProperty,
  updateBody,
}: {
  authContext: ReturnType<typeof getBetterAuthContext>;
  existingProperty: typeof property.$inferSelect;
  updateBody: Record<string, unknown>;
}) {
  const canUpdateProperty = hasPermission(authContext, {
    resource: DATABASE_RESOURCES.property,
    action: "update",
  });

  if (canUpdateProperty) {
    return null;
  }

  const definedKeys = Object.entries(updateBody)
    .filter(([, value]) => value !== undefined)
    .map(([key]) => key);
  const statusActionKeys = new Set(["isPublished", "isVerified"]);
  const generalUpdateKeys = definedKeys.filter((key) => !statusActionKeys.has(key));

  if (generalUpdateKeys.length > 0) {
    return {
      action: "update",
      fields: generalUpdateKeys,
    };
  }

  const isPublishedChanged =
    typeof updateBody.isPublished === "boolean" &&
    updateBody.isPublished !== existingProperty.isPublished;
  const isVerifiedChanged =
    typeof updateBody.isVerified === "boolean" &&
    updateBody.isVerified !== existingProperty.isVerified;

  if (
    isPublishedChanged &&
    !hasPermission(authContext, { resource: DATABASE_RESOURCES.property, action: "publish" })
  ) {
    return {
      action: "publish",
      fields: ["isPublished"],
    };
  }

  if (
    isVerifiedChanged &&
    !hasPermission(authContext, { resource: DATABASE_RESOURCES.property, action: "verify" })
  ) {
    return {
      action: "verify",
      fields: ["isVerified"],
    };
  }

  return null;
}

async function canAccessPropertyAsCurrentUser(
  propertyData: Pick<typeof property.$inferSelect, "id" | "createdByUser" | "superOwnerId">,
  userId?: string | null
) {
  if (!userId) {
    return false;
  }

  if (propertyData.createdByUser === userId || propertyData.superOwnerId === userId) {
    return true;
  }

  return Boolean(
    await db
      .select({ id: propertyOwner.id })
      .from(propertyOwner)
      .where(and(eq(propertyOwner.propertyId, propertyData.id), eq(propertyOwner.userId, userId)))
      .limit(1)
      .then((rows) => rows[0])
  );
}

function hasEMandateMedia(mediaItems?: import("./utils").PropertyMediaInput[]) {
  return (mediaItems ?? []).some((mediaItem) => isEMandateMedia(mediaItem));
}

function isEMandateMedia(mediaItem: import("./utils").PropertyMediaInput) {
  return (
    mediaItem.mediaType === "DOCUMENT" &&
    mediaItem.mimeType === "application/pdf" &&
    (mediaItem.altText === E_MANDATE_MEDIA_ALT_TEXT ||
      mediaItem.name.trim().toLowerCase() === E_MANDATE_MEDIA_NAME.toLowerCase() ||
      mediaItem.storageKey.includes("/e-mandate/"))
  );
}

function normalizeBrokerEMandateVisibility(
  mediaItems: import("./utils").PropertyMediaInput[] | undefined,
  existingMediaItems: import("./utils").PropertyMediaInput[] = []
) {
  if (mediaItems === undefined) {
    return undefined;
  }

  return mediaItems.map((mediaItem) => {
    if (!isEMandateMedia(mediaItem)) {
      return mediaItem;
    }

    const existingMediaItem = existingMediaItems.find(
      (item) => item.storageKey === mediaItem.storageKey || item.url === mediaItem.url
    );

    return {
      ...mediaItem,
      visibility: existingMediaItem?.visibility ?? "PRIVATE",
    };
  });
}

async function getOrganizationOwnerRecipients(organizationId: string) {
  return db
    .select({
      name: user.name,
      email: user.email,
    })
    .from(member)
    .innerJoin(user, eq(user.id, member.userId))
    .where(
      and(
        eq(member.organizationId, organizationId),
        eq(member.role, "owner"),
        eq(member.isDeleted, false),
        eq(user.isDeleted, false)
      )
    );
}

async function notifyPropertyPublished(
  propertyData: Awaited<ReturnType<typeof findPropertyByIdWithRelations>>,
  logContext: string
) {
  if (!propertyData?.isPublished || !propertyData.organizationId) {
    return;
  }

  const organizationOwners = await getOrganizationOwnerRecipients(propertyData.organizationId);

  await sendPropertyPublishedNotificationEmails({
    propertyId: propertyData.id,
    propertyName: propertyData.name,
    organizationName: propertyData.organization?.name ?? "Proptryx",
    propertyOwner: propertyData.superOwner
      ? {
          name: propertyData.superOwner.name,
          email: propertyData.superOwner.email,
        }
      : null,
    organizationOwners,
    publishedAt: propertyData.updatedAt ?? propertyData.createdAt,
  }).catch((err) => {
    logger.error(`[${logContext}] Property published email send failed:`, { error: err });
  });
}

registerOpenApiRoute(kernelCompanyPropertyGroup, list, async (c) => {
  const query = c.req.valid("query");
  const authContext = getBetterAuthContext(c);
  const companyPanelOrganizationId = getCompanyPanelOrganizationId(c);
  const isBrokerUser = isProptryxBrokerUser(c);
  const isUserAccess = getPropertyAccessLevel(c) === "user";
  const response = await fetchPropertyList({
    ...query,
    createdByUser: isBrokerUser ? (authContext.user?.id ?? "__none__") : query.createdByUser,
    ownUserId:
      !isBrokerUser && isUserAccess ? (authContext.user?.id ?? "__none__") : query.ownUserId,
    organizationId: isBrokerUser ? undefined : (companyPanelOrganizationId ?? query.organizationId),
  });

  return c.json(
    createSuccessResponse({
      ...response,
      items: await attachPropertyRelations(response.items),
    }),
    200
  );
});

registerOpenApiRoute(kernelCompanyPropertyGroup, get, async (c) => {
  const { id } = c.req.valid("param");
  const query = c.req.valid("query");
  const authContext = getBetterAuthContext(c);
  const companyPanelOrganizationId = getCompanyPanelOrganizationId(c);
  const isBrokerUser = isProptryxBrokerUser(c);
  const isUserAccess = getPropertyAccessLevel(c) === "user";
  const propertyData = await findPropertyByIdWithRelations(id, {
    includeDeleted: query.includeDeleted,
  });

  if (
    !propertyData ||
    (companyPanelOrganizationId && propertyData.organizationId !== companyPanelOrganizationId) ||
    (isBrokerUser && propertyData.createdByUser !== authContext.user?.id) ||
    (!isBrokerUser &&
      isUserAccess &&
      !(await canAccessPropertyAsCurrentUser(propertyData, authContext.user?.id)))
  ) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No property found with id ${id}`,
      }),
      404
    );
  }

  return c.json(createSuccessResponse(propertyData), 200);
});

registerOpenApiRoute(kernelCompanyPropertyGroup, create, async (c) => {
  const body = c.req.valid("json");
  const {
    coOwnerIds,
    ownerTerms,
    temporaryOwnerTerms,
    mediaItems,
    retailDetails,
    officeDetails,
    warehouseDetails,
    parkingDetails,
    ...propertyBody
  } = body as typeof body & {
    coOwnerIds?: string[];
    ownerTerms?: import("./utils").PropertyOwnerTermsInput[];
    temporaryOwnerTerms?: import("./utils").PropertyTemporaryOwnerTermsInput[];
    mediaItems?: import("./utils").PropertyMediaInput[];
    retailDetails?: import("./utils").PropertyTypeDetailsInput["retailDetails"];
    officeDetails?: import("./utils").PropertyTypeDetailsInput["officeDetails"];
    warehouseDetails?: import("./utils").PropertyTypeDetailsInput["warehouseDetails"];
    parkingDetails?: import("./utils").PropertyTypeDetailsInput["parkingDetails"];
  };
  const authContext = getBetterAuthContext(c);
  const { user: currentUser } = authContext;
  const isBrokerUser =
    currentUser?.panel === "proptryx" && currentUser.role?.trim().toLowerCase() === "broker";
  const companyPanelOrganizationId = getCompanyPanelOrganizationId(c);
  const effectiveSuperOwnerId = isBrokerUser
    ? (currentUser?.id ?? null)
    : propertyBody.superOwnerId;
  const effectivePropertyBody = {
    ...propertyBody,
    organizationId: isBrokerUser
      ? null
      : (companyPanelOrganizationId ?? propertyBody.organizationId),
    superOwnerId: effectiveSuperOwnerId,
  };
  const effectiveMediaItems = isBrokerUser
    ? normalizeBrokerEMandateVisibility(mediaItems)
    : mediaItems;

  if (
    propertyBody.isPublished === true &&
    !hasPermission(authContext, { resource: DATABASE_RESOURCES.property, action: "publish" })
  ) {
    return c.json(
      createErrorResponse({
        error: "Forbidden",
        message: "Missing permission: property.publish",
      }),
      403
    );
  }

  if (
    propertyBody.isVerified === true &&
    !hasPermission(authContext, { resource: DATABASE_RESOURCES.property, action: "verify" })
  ) {
    return c.json(
      createErrorResponse({
        error: "Forbidden",
        message: "Missing permission: property.verify",
      }),
      403
    );
  }

  if (isBrokerUser && !hasEMandateMedia(effectiveMediaItems)) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: "E-mandate PDF is required for broker property creation",
      }),
      400
    );
  }

  if (!(isBrokerUser || effectivePropertyBody.organizationId)) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: "Organization id is required",
      }),
      400
    );
  }

  if (effectivePropertyBody.organizationId) {
    const propertyLimitCheck = await checkOrganizationLimit({
      organizationId: effectivePropertyBody.organizationId,
      featureName: "properties",
    });

    if (!propertyLimitCheck.allowed) {
      return c.json(
        createErrorResponse({
          error: "Forbidden",
          message: buildOrganizationLimitDeniedMessage({
            featureName: propertyLimitCheck.normalizedFeatureName,
            entry: propertyLimitCheck.entry,
            reason: propertyLimitCheck.reason,
          }),
        }),
        403
      );
    }
  }

  const normalizedOwnerTerms = normalizePropertyOwnerTerms({
    superOwnerId: effectivePropertyBody.superOwnerId,
    coOwnerIds,
    ownerTerms,
  });
  const referenceValidation = await validateKernelPropertyReferences({
    organizationId: effectivePropertyBody.organizationId,
    superOwnerId: effectivePropertyBody.superOwnerId,
    coOwnerIds: getValidatedCoOwnerIdsFromOwnerTerms(
      normalizedOwnerTerms,
      effectivePropertyBody.superOwnerId
    ),
  });

  if (!referenceValidation.valid) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: "Property contains invalid references",
        details: referenceValidation.errors,
      }),
      400
    );
  }

  const derivedFields = getDerivedPropertyFields(effectivePropertyBody);

  const [createdProperty] = await db.transaction(async (tx) => {
    const [insertedProperty] = await tx
      .insert(property)
      .values({
        id: generateRandomId(),
        ...effectivePropertyBody,
        ...derivedFields,
        createdByUser: currentUser?.id ?? null,
      })
      .returning();

    if (normalizedOwnerTerms.length > 0) {
      await tx.insert(propertyOwner).values(
        normalizedOwnerTerms.map((ownerTerm) => ({
          propertyId: insertedProperty.id,
          userId: ownerTerm.userId,
          floorNumber: ownerTerm.floorNumber ?? null,
          allocatedAreaSqft: ownerTerm.allocatedAreaSqft ?? null,
          areaDescription: ownerTerm.areaDescription ?? null,
          handoverType: ownerTerm.handoverType ?? null,
          pricePerUnit: ownerTerm.pricePerUnit ?? null,
          priceUnit: ownerTerm.priceUnit ?? null,
          priceNegotiable: ownerTerm.priceNegotiable ?? null,
        }))
      );
    }

    await replacePropertyMediaItems({
      tx,
      propertyId: insertedProperty.id,
      mediaItems: effectiveMediaItems,
      userId: currentUser?.id ?? null,
    });
    await replacePropertyTemporaryOwnerTerms({
      tx,
      propertyId: insertedProperty.id,
      temporaryOwnerTerms,
    });
    await replacePropertyTypeDetails({
      tx,
      propertyId: insertedProperty.id,
      type: insertedProperty.type,
      details: { retailDetails, officeDetails, warehouseDetails, parkingDetails },
    });

    return [insertedProperty];
  });

  const propertyData = await findPropertyByIdWithRelations(createdProperty.id, {
    includeDeleted: true,
  });

  if (propertyData?.isPublished) {
    await notifyPropertyPublished(propertyData, "kernel.company.property.create");
  }

  return c.json(createSuccessResponse(propertyData ?? createdProperty), 201);
});

registerOpenApiRoute(kernelCompanyPropertyGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const {
    coOwnerIds,
    ownerTerms,
    temporaryOwnerTerms,
    mediaItems,
    retailDetails,
    officeDetails,
    warehouseDetails,
    parkingDetails,
    ...propertyBody
  } = body as typeof body & {
    coOwnerIds?: string[];
    ownerTerms?: import("./utils").PropertyOwnerTermsInput[];
    temporaryOwnerTerms?: import("./utils").PropertyTemporaryOwnerTermsInput[];
    mediaItems?: import("./utils").PropertyMediaInput[];
    retailDetails?: import("./utils").PropertyTypeDetailsInput["retailDetails"];
    officeDetails?: import("./utils").PropertyTypeDetailsInput["officeDetails"];
    warehouseDetails?: import("./utils").PropertyTypeDetailsInput["warehouseDetails"];
    parkingDetails?: import("./utils").PropertyTypeDetailsInput["parkingDetails"];
  };
  const { user: currentUser } = getBetterAuthContext(c);
  const isBrokerUser =
    currentUser?.panel === "proptryx" && currentUser.role?.trim().toLowerCase() === "broker";
  const companyPanelOrganizationId = getCompanyPanelOrganizationId(c);
  const authContext = getBetterAuthContext(c);
  const isUserAccess = getPropertyAccessLevel(c) === "user";
  const existingProperty = await findPropertyById(id);

  if (
    !existingProperty ||
    (companyPanelOrganizationId &&
      existingProperty.organizationId !== companyPanelOrganizationId) ||
    (isBrokerUser && existingProperty.createdByUser !== currentUser?.id) ||
    (!isBrokerUser &&
      isUserAccess &&
      !(await canAccessPropertyAsCurrentUser(existingProperty, authContext.user?.id)))
  ) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No property found with id ${id}`,
      }),
      404
    );
  }

  const updatePermissionError = getPropertyUpdatePermissionError({
    authContext,
    existingProperty,
    updateBody: body as Record<string, unknown>,
  });

  if (updatePermissionError) {
    return c.json(
      createErrorResponse({
        error: "Forbidden",
        message: `Missing permission: property.${updatePermissionError.action}`,
        details: updatePermissionError,
      }),
      403
    );
  }

  const existingPropertyWithRelations =
    isBrokerUser && mediaItems !== undefined
      ? await findPropertyByIdWithRelations(id, { includeDeleted: true })
      : null;
  const effectiveMediaItems = isBrokerUser
    ? normalizeBrokerEMandateVisibility(mediaItems, existingPropertyWithRelations?.mediaItems ?? [])
    : mediaItems;

  if (isBrokerUser && mediaItems !== undefined && !hasEMandateMedia(effectiveMediaItems)) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: "Broker properties must keep an e-mandate PDF",
      }),
      400
    );
  }

  const effectiveOrganizationId = isBrokerUser
    ? null
    : (companyPanelOrganizationId ??
      propertyBody.organizationId ??
      existingProperty.organizationId);
  const effectiveSuperOwnerId = isBrokerUser
    ? (currentUser?.id ?? existingProperty.superOwnerId)
    : (propertyBody.superOwnerId ?? existingProperty.superOwnerId);
  const effectivePropertyBody = {
    ...propertyBody,
    organizationId: effectiveOrganizationId,
    superOwnerId: effectiveSuperOwnerId,
  };

  const normalizedOwnerTerms = normalizePropertyOwnerTerms({
    superOwnerId: effectiveSuperOwnerId,
    coOwnerIds,
    ownerTerms,
  });
  const existingOwnerTerms =
    coOwnerIds !== undefined || ownerTerms !== undefined
      ? ((await findPropertyByIdWithRelations(id, { includeDeleted: true }))?.ownerTerms ?? [])
      : [];
  const mergedOwnerTerms =
    existingOwnerTerms.length > 0
      ? mergePropertyOwnerTermsWithExisting(normalizedOwnerTerms, existingOwnerTerms)
      : normalizedOwnerTerms;
  const referenceValidation = await validateKernelPropertyReferences({
    organizationId: effectiveOrganizationId,
    superOwnerId: effectiveSuperOwnerId,
    coOwnerIds: getValidatedCoOwnerIdsFromOwnerTerms(mergedOwnerTerms, effectiveSuperOwnerId),
  });

  if (!referenceValidation.valid) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: "Property contains invalid references",
        details: referenceValidation.errors,
      }),
      400
    );
  }

  await db.transaction(async (tx) => {
    await tx
      .update(property)
      .set(
        stripUndefinedFields({
          ...propertyBody,
          ...effectivePropertyBody,
          ...getDerivedPropertyFields(effectivePropertyBody, existingProperty),
          updatedByUser: currentUser?.id ?? null,
        })
      )
      .where(eq(property.id, id));

    if (coOwnerIds !== undefined || ownerTerms !== undefined) {
      await tx.delete(propertyOwner).where(eq(propertyOwner.propertyId, id));

      if (mergedOwnerTerms.length > 0) {
        await tx.insert(propertyOwner).values(
          mergedOwnerTerms.map((ownerTerm) => ({
            propertyId: id,
            userId: ownerTerm.userId,
            floorNumber: ownerTerm.floorNumber ?? null,
            allocatedAreaSqft: ownerTerm.allocatedAreaSqft ?? null,
            areaDescription: ownerTerm.areaDescription ?? null,
            handoverType: ownerTerm.handoverType ?? null,
            pricePerUnit: ownerTerm.pricePerUnit ?? null,
            priceUnit: ownerTerm.priceUnit ?? null,
            priceNegotiable: ownerTerm.priceNegotiable ?? null,
          }))
        );
      }
    }

    await replacePropertyMediaItems({
      tx,
      propertyId: id,
      mediaItems: effectiveMediaItems,
      userId: currentUser?.id ?? null,
    });
    await replacePropertyTemporaryOwnerTerms({
      tx,
      propertyId: id,
      temporaryOwnerTerms,
    });

    if (
      propertyBody.type !== undefined ||
      retailDetails !== undefined ||
      officeDetails !== undefined ||
      warehouseDetails !== undefined ||
      parkingDetails !== undefined
    ) {
      await replacePropertyTypeDetails({
        tx,
        propertyId: id,
        type: propertyBody.type ?? existingProperty.type,
        details: { retailDetails, officeDetails, warehouseDetails, parkingDetails },
      });
    }
  });

  const propertyData = await findPropertyByIdWithRelations(id, {
    includeDeleted: true,
  });

  if (propertyData?.isPublished && !existingProperty.isPublished) {
    await notifyPropertyPublished(propertyData, "kernel.company.property.update");
  }

  return c.json(createSuccessResponse(propertyData ?? existingProperty), 200);
});

registerOpenApiRoute(kernelCompanyPropertyGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);
  const isBrokerUser = isProptryxBrokerUser(c);
  const companyPanelOrganizationId = getCompanyPanelOrganizationId(c);
  const isUserAccess = getPropertyAccessLevel(c) === "user";
  const existingProperty = await findPropertyById(id, {
    includeDeleted: true,
  });

  if (
    !existingProperty ||
    (companyPanelOrganizationId &&
      existingProperty.organizationId !== companyPanelOrganizationId) ||
    (isBrokerUser && existingProperty.createdByUser !== currentUser?.id) ||
    (!isBrokerUser &&
      isUserAccess &&
      !(await canAccessPropertyAsCurrentUser(existingProperty, currentUser?.id)))
  ) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No property found with id ${id}`,
      }),
      404
    );
  }

  if (existingProperty.isDeleted) {
    return c.json(
      createErrorResponse({
        error: "Already Deleted",
        message: `Property with id ${id} is already deleted.`,
      }),
      400
    );
  }

  await db
    .update(property)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: currentUser?.id ?? null,
      updatedByUser: currentUser?.id ?? null,
    })
    .where(eq(property.id, id));

  const propertyData = await findPropertyByIdWithRelations(id, {
    includeDeleted: true,
  });

  return c.json(createSuccessResponse(propertyData ?? existingProperty), 200);
});

registerOpenApiRoute(kernelCompanyPropertyGroup, restore, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);
  const isBrokerUser = isProptryxBrokerUser(c);
  const companyPanelOrganizationId = getCompanyPanelOrganizationId(c);
  const isUserAccess = getPropertyAccessLevel(c) === "user";
  const existingProperty = await findPropertyById(id, {
    includeDeleted: true,
  });

  if (
    !existingProperty ||
    (companyPanelOrganizationId &&
      existingProperty.organizationId !== companyPanelOrganizationId) ||
    (isBrokerUser && existingProperty.createdByUser !== currentUser?.id) ||
    (!isBrokerUser &&
      isUserAccess &&
      !(await canAccessPropertyAsCurrentUser(existingProperty, currentUser?.id)))
  ) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No property found with id ${id}`,
      }),
      404
    );
  }

  if (!existingProperty.isDeleted) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: `Property with id ${id} is already active.`,
      }),
      409
    );
  }

  if (existingProperty.organizationId) {
    const propertyLimitCheck = await checkOrganizationLimit({
      organizationId: existingProperty.organizationId,
      featureName: "properties",
    });

    if (!propertyLimitCheck.allowed) {
      return c.json(
        createErrorResponse({
          error: "Forbidden",
          message: buildOrganizationLimitDeniedMessage({
            featureName: propertyLimitCheck.normalizedFeatureName,
            entry: propertyLimitCheck.entry,
            reason: propertyLimitCheck.reason,
          }),
        }),
        403
      );
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(property)
      .set({
        isDeleted: false,
        deletedAt: null,
        deletedByUser: null,
        updatedByUser: currentUser?.id ?? null,
      })
      .where(eq(property.id, id));

    await tx
      .update(propertyMedia)
      .set({
        isDeleted: false,
        deletedAt: null,
        deletedByUser: null,
        updatedByUser: currentUser?.id ?? null,
      })
      .where(eq(propertyMedia.propertyId, id));

    await tx
      .update(propertyZone)
      .set({
        isDeleted: false,
        deletedAt: null,
        deletedByUser: null,
        updatedByUser: currentUser?.id ?? null,
      })
      .where(eq(propertyZone.propertyId, id));
  });

  const propertyData = await findPropertyByIdWithRelations(id, {
    includeDeleted: true,
  });

  return c.json(createSuccessResponse(propertyData ?? existingProperty), 200);
});

registerOpenApiRoute(kernelCompanyPropertyGroup, removePermanently, async (c) => {
  const { id } = c.req.valid("param");
  const companyPanelOrganizationId = getCompanyPanelOrganizationId(c);
  const authContext = getBetterAuthContext(c);
  const isBrokerUser = isProptryxBrokerUser(c);
  const isUserAccess = getPropertyAccessLevel(c) === "user";
  const existingProperty = await findPropertyById(id, {
    includeDeleted: true,
  });

  if (
    !existingProperty ||
    (companyPanelOrganizationId &&
      existingProperty.organizationId !== companyPanelOrganizationId) ||
    (isBrokerUser && existingProperty.createdByUser !== authContext.user?.id) ||
    (!isBrokerUser &&
      isUserAccess &&
      !(await canAccessPropertyAsCurrentUser(existingProperty, authContext.user?.id)))
  ) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No property found with id ${id}`,
      }),
      404
    );
  }

  const mediaObjects = await db
    .select({ storageKey: propertyMedia.storageKey })
    .from(propertyMedia)
    .where(eq(propertyMedia.propertyId, id));
  const [deletedProperty] = await db
    .delete(property)
    .where(eq(property.id, id))
    .returning({ id: property.id });

  if (!deletedProperty) {
    return c.json(
      createErrorResponse({
        error: "Internal Server Error",
        message: `Failed to permanently delete property with id ${id}`,
      }),
      500
    );
  }

  await deleteUploadObjects(mediaObjects.map((media) => media.storageKey));

  return c.json(
    createSuccessResponse({
      message: "Property permanently deleted successfully",
    }),
    200
  );
});
