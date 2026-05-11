import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import { db, property } from "@proptryx/database";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
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
  const { user: currentUser } = getBetterAuthContext(c);
  const referenceValidation = await validateKernelPropertyReferences({
    organizationId: body.organizationId,
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
      createdByUser: currentUser?.id ?? null,
    })
    .returning();

  const propertyData = await findPropertyByIdWithRelations(createdProperty.id, {
    includeDeleted: true,
  });

  return c.json(createSuccessResponse(propertyData ?? createdProperty), 201);
});

registerOpenApiRoute(kernelCompanyPropertyGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
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

  const effectiveOrganizationId = body.organizationId ?? existingProperty.organizationId;
  const effectiveSuperOwnerId = body.superOwnerId ?? existingProperty.superOwnerId;

  const referenceValidation = await validateKernelPropertyReferences({
    organizationId: effectiveOrganizationId,
    superOwnerId: effectiveSuperOwnerId,
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
        updatedByUser: currentUser?.id ?? null,
      })
    )
    .where(eq(property.id, id));

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
