import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import { db, faq } from "@proptryx/database";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@proptryx/utils";
import { eq } from "drizzle-orm";
import { create, get, list, remove, removePermanently, restore, update } from "./openapi.route";
import { fetchFaqList } from "./list";
import {
  applyFaqListAccessScope,
  canAccessFaqRecord,
  findAccessibleActivePropertyById,
  findFaqById,
  type SiteDataPropertyAccessContext,
} from "./utils";

export const faqsGroup = new OpenAPIHono<AppBindings>();

function getPropertyAccessContext(c: Parameters<typeof getBetterAuthContext>[0]) {
  const authContext = getBetterAuthContext(c);

  return {
    userId: authContext.user?.id ?? null,
    panel: authContext.authorization.panel ?? authContext.user?.panel ?? null,
    role: authContext.authorization.role ?? authContext.user?.role ?? null,
    organizationId:
      authContext.session?.activeOrganizationId ??
      authContext.member?.organizationId ??
      authContext.organization?.id ??
      null,
  } satisfies SiteDataPropertyAccessContext;
}

registerOpenApiRoute(faqsGroup, list, async (c) => {
  const query = c.req.valid("query");
  const response = await fetchFaqList(applyFaqListAccessScope(query, getPropertyAccessContext(c)));

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(faqsGroup, get, async (c) => {
  const { id } = c.req.valid("param");
  const faqData = await findFaqById(id);

  if (!faqData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No FAQ found with id ${id}`,
      }),
      404
    );
  }

  if (!(await canAccessFaqRecord(faqData, getPropertyAccessContext(c)))) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No FAQ found with id ${id}`,
      }),
      404
    );
  }

  return c.json(createSuccessResponse(faqData), 200);
});

registerOpenApiRoute(faqsGroup, create, async (c) => {
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  const accessContext = getPropertyAccessContext(c);

  const linkedProperty = await findAccessibleActivePropertyById(body.propertyId, accessContext);

  if (!linkedProperty) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No active property found with id ${body.propertyId}`,
      }),
      404
    );
  }

  const [createdFaq] = await db
    .insert(faq)
    .values({
      ...body,
      id: generateRandomId(),
      createdByUser: user?.id ?? null,
    })
    .returning();

  return c.json(createSuccessResponse(createdFaq), 201);
});

registerOpenApiRoute(faqsGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  const accessContext = getPropertyAccessContext(c);

  const existingFaq = await findFaqById(id);

  if (!existingFaq) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No FAQ found with id ${id}`,
      }),
      404
    );
  }

  if (!(await canAccessFaqRecord(existingFaq, accessContext))) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No FAQ found with id ${id}`,
      }),
      404
    );
  }

  if (body.propertyId !== undefined) {
    const linkedProperty = await findAccessibleActivePropertyById(body.propertyId, accessContext);

    if (!linkedProperty) {
      return c.json(
        createErrorResponse({
          error: "Not Found",
          message: `No active property found with id ${body.propertyId}`,
        }),
        404
      );
    }
  }

  const [updatedFaq] = await db
    .update(faq)
    .set({
      ...body,
      updatedByUser: user?.id ?? null,
    })
    .where(eq(faq.id, id))
    .returning();

  return c.json(createSuccessResponse(updatedFaq), 200);
});

registerOpenApiRoute(faqsGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const { user } = getBetterAuthContext(c);
  const accessContext = getPropertyAccessContext(c);

  const existingFaq = await findFaqById(id, { includeDeleted: true });

  if (!existingFaq) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No FAQ found with id ${id}`,
      }),
      404
    );
  }

  if (!(await canAccessFaqRecord(existingFaq, accessContext))) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No FAQ found with id ${id}`,
      }),
      404
    );
  }

  if (existingFaq.isDeleted) {
    return c.json(
      createErrorResponse({
        error: "Already Deleted",
        message: `FAQ with id ${id} is already deleted.`,
      }),
      400
    );
  }

  const [deletedFaq] = await db
    .update(faq)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: user?.id ?? null,
    })
    .where(eq(faq.id, id))
    .returning();

  return c.json(createSuccessResponse(deletedFaq), 200);
});

registerOpenApiRoute(faqsGroup, restore, async (c) => {
  const { id } = c.req.valid("param");
  const { user } = getBetterAuthContext(c);
  const accessContext = getPropertyAccessContext(c);
  const existingFaq = await findFaqById(id, { includeDeleted: true });

  if (!existingFaq) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No FAQ found with id ${id}`,
      }),
      404
    );
  }

  if (!(await canAccessFaqRecord(existingFaq, accessContext))) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No FAQ found with id ${id}`,
      }),
      404
    );
  }

  if (!existingFaq.isDeleted) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: `FAQ with id ${id} is already active.`,
      }),
      409
    );
  }

  const [restoredFaq] = await db
    .update(faq)
    .set({
      isDeleted: false,
      deletedAt: null,
      deletedByUser: null,
      updatedByUser: user?.id ?? null,
    })
    .where(eq(faq.id, id))
    .returning();

  return c.json(createSuccessResponse(restoredFaq), 200);
});

registerOpenApiRoute(faqsGroup, removePermanently, async (c) => {
  const { id } = c.req.valid("param");
  const accessContext = getPropertyAccessContext(c);
  const existingFaq = await findFaqById(id, { includeDeleted: true });

  if (!existingFaq) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No FAQ found with id ${id}`,
      }),
      404
    );
  }

  if (!(await canAccessFaqRecord(existingFaq, accessContext))) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No FAQ found with id ${id}`,
      }),
      404
    );
  }

  await db.delete(faq).where(eq(faq.id, id));

  return c.json(
    createSuccessResponse({
      message: "FAQ permanently deleted successfully",
    }),
    200
  );
});
