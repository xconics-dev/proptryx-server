import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { db, property } from "@proptryx/database";
import {
  checkCurrentOrganizationLimit,
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  registerOpenApiRoute,
  resolveCurrentOrganizationAccess,
} from "@proptryx/utils";
import { eq } from "drizzle-orm";
import { create, get, list, remove, update } from "./openapi.route";
import { fetchPropertyList } from "./list";
import {
  attachPropertyRelations,
  findPropertyById,
  findPropertyByIdWithRelations,
  getDerivedPropertyFields,
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

  const referenceValidation = await validateCompanyPropertyReferences({
    organizationId: scopedOrganization.organizationId,
    superOwnerId: body.superOwnerId,
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

  const derivedFields = getDerivedPropertyFields(body);

  const [createdProperty] = await db
    .insert(property)
    .values({
      id: generateRandomId(),
      ...body,
      ...derivedFields,
      organizationId: scopedOrganization.organizationId,
      createdByUser: scopedOrganization.user?.id ?? null,
    })
    .returning();

  const propertyData = await findPropertyByIdWithRelations(createdProperty.id, {
    organizationId: scopedOrganization.organizationId,
    includeDeleted: true,
  });

  return c.json(createSuccessResponse(propertyData ?? createdProperty), 201);
});

registerOpenApiRoute(propertyGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
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

  const referenceValidation = await validateCompanyPropertyReferences({
    organizationId: scopedOrganization.organizationId,
    superOwnerId: body.superOwnerId,
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

  await db
    .update(property)
    .set(
      stripUndefinedFields({
        ...body,
        ...getDerivedPropertyFields(body, existingProperty),
        updatedByUser: scopedOrganization.user?.id ?? null,
      })
    )
    .where(eq(property.id, id));

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
    .where(eq(property.id, id));

  const propertyData = await findPropertyByIdWithRelations(id, {
    organizationId: scopedOrganization.organizationId,
    includeDeleted: true,
  });

  return c.json(createSuccessResponse(propertyData ?? existingProperty), 200);
});
