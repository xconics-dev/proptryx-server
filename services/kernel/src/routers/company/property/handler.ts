import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import { db, property, propertyMedia, propertyOwner, propertyZone } from "@proptryx/database";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@proptryx/utils";
import { eq } from "drizzle-orm";
import { create, get, list, remove, removePermanently, restore, update } from "./openapi.route";
import { fetchPropertyList } from "./list";
import {
  attachPropertyRelations,
  findPropertyById,
  findPropertyByIdWithRelations,
  getValidatedCoOwnerIdsFromOwnerTerms,
  getDerivedPropertyFields,
  normalizePropertyOwnerTerms,
  replacePropertyMediaItems,
  replacePropertyTypeDetails,
  stripUndefinedFields,
  validateKernelPropertyReferences,
} from "./utils";

export const kernelCompanyPropertyGroup = new OpenAPIHono<AppBindings>();

registerOpenApiRoute(kernelCompanyPropertyGroup, list, async (c) => {
  const query = c.req.valid("query");
  const response = await fetchPropertyList(query);

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
  const propertyData = await findPropertyByIdWithRelations(id, {
    includeDeleted: query.includeDeleted,
  });

  if (!propertyData) {
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
    mediaItems,
    retailDetails,
    officeDetails,
    warehouseDetails,
    parkingDetails,
    ...propertyBody
  } = body as typeof body & {
    coOwnerIds?: string[];
    ownerTerms?: import("./utils").PropertyOwnerTermsInput[];
    mediaItems?: import("./utils").PropertyMediaInput[];
    retailDetails?: import("./utils").PropertyTypeDetailsInput["retailDetails"];
    officeDetails?: import("./utils").PropertyTypeDetailsInput["officeDetails"];
    warehouseDetails?: import("./utils").PropertyTypeDetailsInput["warehouseDetails"];
    parkingDetails?: import("./utils").PropertyTypeDetailsInput["parkingDetails"];
  };
  const { user: currentUser } = getBetterAuthContext(c);
  const normalizedOwnerTerms = normalizePropertyOwnerTerms({
    superOwnerId: propertyBody.superOwnerId,
    coOwnerIds,
    ownerTerms,
  });
  const referenceValidation = await validateKernelPropertyReferences({
    organizationId: propertyBody.organizationId,
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
      mediaItems,
      userId: currentUser?.id ?? null,
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

  return c.json(createSuccessResponse(propertyData ?? createdProperty), 201);
});

registerOpenApiRoute(kernelCompanyPropertyGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const {
    coOwnerIds,
    ownerTerms,
    mediaItems,
    retailDetails,
    officeDetails,
    warehouseDetails,
    parkingDetails,
    ...propertyBody
  } = body as typeof body & {
    coOwnerIds?: string[];
    ownerTerms?: import("./utils").PropertyOwnerTermsInput[];
    mediaItems?: import("./utils").PropertyMediaInput[];
    retailDetails?: import("./utils").PropertyTypeDetailsInput["retailDetails"];
    officeDetails?: import("./utils").PropertyTypeDetailsInput["officeDetails"];
    warehouseDetails?: import("./utils").PropertyTypeDetailsInput["warehouseDetails"];
    parkingDetails?: import("./utils").PropertyTypeDetailsInput["parkingDetails"];
  };
  const { user: currentUser } = getBetterAuthContext(c);
  const existingProperty = await findPropertyById(id);

  if (!existingProperty) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No property found with id ${id}`,
      }),
      404
    );
  }

  const effectiveOrganizationId = propertyBody.organizationId ?? existingProperty.organizationId;
  const effectiveSuperOwnerId = propertyBody.superOwnerId ?? existingProperty.superOwnerId;

  const normalizedOwnerTerms = normalizePropertyOwnerTerms({
    superOwnerId: effectiveSuperOwnerId,
    coOwnerIds,
    ownerTerms,
  });
  const referenceValidation = await validateKernelPropertyReferences({
    organizationId: effectiveOrganizationId,
    superOwnerId: effectiveSuperOwnerId,
    coOwnerIds: getValidatedCoOwnerIdsFromOwnerTerms(normalizedOwnerTerms, effectiveSuperOwnerId),
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
          updatedByUser: currentUser?.id ?? null,
        })
      )
      .where(eq(property.id, id));

    if (coOwnerIds !== undefined || ownerTerms !== undefined) {
      await tx.delete(propertyOwner).where(eq(propertyOwner.propertyId, id));

      if (normalizedOwnerTerms.length > 0) {
        await tx.insert(propertyOwner).values(
          normalizedOwnerTerms.map((ownerTerm) => ({
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
      userId: currentUser?.id ?? null,
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

  return c.json(createSuccessResponse(propertyData ?? existingProperty), 200);
});

registerOpenApiRoute(kernelCompanyPropertyGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const { user: currentUser } = getBetterAuthContext(c);
  const existingProperty = await findPropertyById(id, {
    includeDeleted: true,
  });

  if (!existingProperty) {
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
  const existingProperty = await findPropertyById(id, {
    includeDeleted: true,
  });

  if (!existingProperty) {
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
  const existingProperty = await findPropertyById(id, {
    includeDeleted: true,
  });

  if (!existingProperty) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No property found with id ${id}`,
      }),
      404
    );
  }

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

  return c.json(
    createSuccessResponse({
      message: "Property permanently deleted successfully",
    }),
    200
  );
});
