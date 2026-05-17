import type { AppBindings } from "@/types/app";
import { logger } from "@/lib/logger";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { db, DATABASE_RESOURCES, member, property, propertyOwner, user } from "@proptryx/database";
import { sendPropertyPublishedNotificationEmails } from "@proptryx/notification";
import {
  checkCurrentOrganizationLimit,
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getPermissionAccessLevel,
  registerOpenApiRoute,
  resolveCurrentOrganizationAccess,
} from "@proptryx/utils";
import { and, eq } from "drizzle-orm";
import { create, get, list, remove, update } from "./openapi.route";
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
  validateCompanyPropertyReferences,
} from "./utils";

export const propertyGroup = new OpenAPIHono<AppBindings>();

function resolveCurrentOrganizationContext(c: Context<AppBindings>) {
  const authCheck = resolveCurrentOrganizationAccess(c);
  const organizationId = authCheck.organizationId;

  if (!organizationId) {
    return {
      errorResponse: c.json(
        createErrorResponse({
          error: "Unauthorized",
          message: "Required organization member access",
        }),
        401
      ),
      organizationId: null,
      user: authCheck.user,
      authContext: authCheck.authContext,
    };
  }

  return {
    errorResponse: null,
    organizationId,
    user: authCheck.user,
    authContext: authCheck.authContext,
  };
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

function hasUserLevelPropertyAccess(scopedOrganization: {
  authContext: ReturnType<typeof resolveCurrentOrganizationAccess>["authContext"];
}) {
  return (
    getPermissionAccessLevel(scopedOrganization.authContext, DATABASE_RESOURCES.property) === "user"
  );
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

registerOpenApiRoute(propertyGroup, list, async (c) => {
  const query = c.req.valid("query");
  const scopedOrganization = resolveCurrentOrganizationContext(c);

  if (scopedOrganization.errorResponse) {
    return scopedOrganization.errorResponse;
  }

  const response = await fetchPropertyList({
    ...query,
    organizationId: scopedOrganization.organizationId,
    ownUserId: hasUserLevelPropertyAccess(scopedOrganization)
      ? (scopedOrganization.user?.id ?? "__none__")
      : query.ownUserId,
  });

  return c.json(
    createSuccessResponse({
      ...response,
      items: await attachPropertyRelations(response.items),
    }),
    200
  );
});

registerOpenApiRoute(propertyGroup, get, async (c) => {
  const { id } = c.req.valid("param");
  const query = c.req.valid("query");
  const scopedOrganization = resolveCurrentOrganizationContext(c);

  if (scopedOrganization.errorResponse) {
    return scopedOrganization.errorResponse;
  }

  const propertyData = await findPropertyByIdWithRelations(id, {
    organizationId: scopedOrganization.organizationId,
    includeDeleted: query.includeDeleted,
  });

  if (
    !propertyData ||
    (hasUserLevelPropertyAccess(scopedOrganization) &&
      !(await canAccessPropertyAsCurrentUser(propertyData, scopedOrganization.user?.id)))
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

registerOpenApiRoute(propertyGroup, create, async (c) => {
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
  const scopedOrganization = resolveCurrentOrganizationContext(c);

  if (scopedOrganization.errorResponse) {
    return scopedOrganization.errorResponse;
  }

  const propertyLimitCheck = await checkCurrentOrganizationLimit(c, "properties");

  if (!propertyLimitCheck.ok) {
    return c.json(
      createErrorResponse({
        error: propertyLimitCheck.error,
        message: propertyLimitCheck.message,
      }),
      propertyLimitCheck.statusCode
    );
  }

  const normalizedOwnerTerms = normalizePropertyOwnerTerms({
    superOwnerId: propertyBody.superOwnerId,
    coOwnerIds,
    ownerTerms,
  });
  const referenceValidation = await validateCompanyPropertyReferences({
    organizationId: scopedOrganization.organizationId,
    superOwnerId: propertyBody.superOwnerId,
    coOwnerIds: getValidatedCoOwnerIdsFromOwnerTerms(
      normalizedOwnerTerms,
      propertyBody.superOwnerId
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

  const derivedFields = getDerivedPropertyFields(propertyBody);

  const [createdProperty] = await db.transaction(async (tx) => {
    const [insertedProperty] = await tx
      .insert(property)
      .values({
        id: generateRandomId(),
        ...propertyBody,
        ...derivedFields,
        organizationId: scopedOrganization.organizationId,
        createdByUser: scopedOrganization.user?.id ?? null,
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
      mediaItems,
      userId: scopedOrganization.user?.id ?? null,
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
    organizationId: scopedOrganization.organizationId,
    includeDeleted: true,
  });

  if (propertyData?.isPublished) {
    await notifyPropertyPublished(propertyData, "property.create");
  }

  return c.json(createSuccessResponse(propertyData ?? createdProperty), 201);
});

registerOpenApiRoute(propertyGroup, update, async (c) => {
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
  const scopedOrganization = resolveCurrentOrganizationContext(c);

  if (scopedOrganization.errorResponse) {
    return scopedOrganization.errorResponse;
  }

  const existingProperty = await findPropertyById(id, {
    organizationId: scopedOrganization.organizationId,
  });

  if (
    !existingProperty ||
    (hasUserLevelPropertyAccess(scopedOrganization) &&
      !(await canAccessPropertyAsCurrentUser(existingProperty, scopedOrganization.user?.id)))
  ) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No property found with id ${id}`,
      }),
      404
    );
  }

  const normalizedOwnerTerms = normalizePropertyOwnerTerms({
    superOwnerId: propertyBody.superOwnerId ?? existingProperty.superOwnerId,
    coOwnerIds,
    ownerTerms,
  });
  const existingOwnerTerms =
    coOwnerIds !== undefined || ownerTerms !== undefined
      ? ((
          await findPropertyByIdWithRelations(id, {
            organizationId: scopedOrganization.organizationId,
            includeDeleted: true,
          })
        )?.ownerTerms ?? [])
      : [];
  const mergedOwnerTerms =
    existingOwnerTerms.length > 0
      ? mergePropertyOwnerTermsWithExisting(normalizedOwnerTerms, existingOwnerTerms)
      : normalizedOwnerTerms;
  const referenceValidation = await validateCompanyPropertyReferences({
    organizationId: scopedOrganization.organizationId,
    superOwnerId: propertyBody.superOwnerId,
    coOwnerIds: getValidatedCoOwnerIdsFromOwnerTerms(
      mergedOwnerTerms,
      propertyBody.superOwnerId ?? existingProperty.superOwnerId
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

  await db.transaction(async (tx) => {
    await tx
      .update(property)
      .set(
        stripUndefinedFields({
          ...propertyBody,
          ...getDerivedPropertyFields(propertyBody, existingProperty),
          updatedByUser: scopedOrganization.user?.id ?? null,
        })
      )
      .where(
        and(eq(property.id, id), eq(property.organizationId, scopedOrganization.organizationId))
      );

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
      mediaItems,
      userId: scopedOrganization.user?.id ?? null,
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
    organizationId: scopedOrganization.organizationId,
    includeDeleted: true,
  });

  if (propertyData?.isPublished && !existingProperty.isPublished) {
    await notifyPropertyPublished(propertyData, "property.update");
  }

  return c.json(createSuccessResponse(propertyData ?? existingProperty), 200);
});

registerOpenApiRoute(propertyGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const scopedOrganization = resolveCurrentOrganizationContext(c);

  if (scopedOrganization.errorResponse) {
    return scopedOrganization.errorResponse;
  }

  const existingProperty = await findPropertyById(id, {
    organizationId: scopedOrganization.organizationId,
    includeDeleted: true,
  });

  if (
    !existingProperty ||
    (hasUserLevelPropertyAccess(scopedOrganization) &&
      !(await canAccessPropertyAsCurrentUser(existingProperty, scopedOrganization.user?.id)))
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
      deletedByUser: scopedOrganization.user?.id ?? null,
      updatedByUser: scopedOrganization.user?.id ?? null,
    })
    .where(
      and(eq(property.id, id), eq(property.organizationId, scopedOrganization.organizationId))
    );

  const propertyData = await findPropertyByIdWithRelations(id, {
    organizationId: scopedOrganization.organizationId,
    includeDeleted: true,
  });

  return c.json(createSuccessResponse(propertyData ?? existingProperty), 200);
});
