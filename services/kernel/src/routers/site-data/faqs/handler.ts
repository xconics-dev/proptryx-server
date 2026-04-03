import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import { db, faq } from "@proptryx/database";
import {
  createErrorResponse,
  createSuccessResponse,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@proptryx/utils";
import { eq } from "drizzle-orm";
import { create, get, list, remove, update } from "./openapi.route";
import { fetchFaqList } from "./list";
import { findFaqById } from "./utils";

export const faqsGroup = new OpenAPIHono<AppBindings>();

registerOpenApiRoute(faqsGroup, list, async (c) => {
  const query = c.req.valid("query");
  const response = await fetchFaqList(query);

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

  return c.json(createSuccessResponse(faqData), 200);
});

registerOpenApiRoute(faqsGroup, create, async (c) => {
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);

  const [createdFaq] = await db
    .insert(faq)
    .values({
      ...body,
      createdByUser: user?.id ?? null,
    })
    .returning();

  return c.json(createSuccessResponse(createdFaq), 201);
});

registerOpenApiRoute(faqsGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);

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
