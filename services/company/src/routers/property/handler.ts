import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { db, property, propertyOwner } from "@proptryx/database";
import {
  checkCurrentOrganizationLimit,
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
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
  normalizePropertyOwnerTerms,
  replacePropertyMediaItems,
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
    };
  }

  return {
    errorResponse: null,
    organizationId,
    user: authCheck.user,
  };
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

registerOpenApiRoute(propertyGroup, create, async (c) => {
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

  return c.json(createSuccessResponse(propertyData ?? createdProperty), 201);
});

registerOpenApiRoute(propertyGroup, update, async (c) => {
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
  const scopedOrganization = resolveCurrentOrganizationContext(c);

  if (scopedOrganization.errorResponse) {
    return scopedOrganization.errorResponse;
  }

  const existingProperty = await findPropertyById(id, {
    organizationId: scopedOrganization.organizationId,
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

  const normalizedOwnerTerms = normalizePropertyOwnerTerms({
    superOwnerId: propertyBody.superOwnerId ?? existingProperty.superOwnerId,
    coOwnerIds,
    ownerTerms,
  });
  const referenceValidation = await validateCompanyPropertyReferences({
    organizationId: scopedOrganization.organizationId,
    superOwnerId: propertyBody.superOwnerId,
    coOwnerIds: getValidatedCoOwnerIdsFromOwnerTerms(
      normalizedOwnerTerms,
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
      userId: scopedOrganization.user?.id ?? null,
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
