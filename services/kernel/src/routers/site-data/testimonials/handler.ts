import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import { db, testimonial } from "@proptryx/database";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@proptryx/utils";
import { and, eq } from "drizzle-orm";
import { create, get, list, remove, update } from "./openapi.route";
import { fetchTestimonialList } from "./list";

export const testimonialsGroup = new OpenAPIHono<AppBindings>();

async function findTestimonialById(id: string, options?: { includeDeleted?: boolean }) {
  const whereClause = options?.includeDeleted
    ? eq(testimonial.id, id)
    : and(eq(testimonial.id, id), eq(testimonial.isDeleted, false));

  return db
    .select()
    .from(testimonial)
    .where(whereClause)
    .limit(1)
    .then((rows) => rows[0]);
}

registerOpenApiRoute(testimonialsGroup, list, async (c) => {
  const query = c.req.valid("query");
  const response = await fetchTestimonialList(query);

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(testimonialsGroup, get, async (c) => {
  const { id } = c.req.valid("param");
  const testimonialData = await findTestimonialById(id);

  if (!testimonialData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No testimonial found with id ${id}`,
      }),
      404
    );
  }

  return c.json(createSuccessResponse(testimonialData), 200);
});

registerOpenApiRoute(testimonialsGroup, create, async (c) => {
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);

  const [createdTestimonial] = await db
    .insert(testimonial)
    .values({
      id: generateRandomId(),
      createdByUser: user?.id ?? null,
      ...body,
    })
    .returning();

  return c.json(createSuccessResponse(createdTestimonial), 201);
});

registerOpenApiRoute(testimonialsGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);

  const existingTestimonial = await findTestimonialById(id);

  if (!existingTestimonial) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No testimonial found with id ${id}`,
      }),
      404
    );
  }

  const [updatedTestimonial] = await db
    .update(testimonial)
    .set({
      ...body,
      updatedByUser: user?.id ?? null,
    })
    .where(eq(testimonial.id, id))
    .returning();

  return c.json(createSuccessResponse(updatedTestimonial), 200);
});

registerOpenApiRoute(testimonialsGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const { user } = getBetterAuthContext(c);

  const existingTestimonial = await findTestimonialById(id, { includeDeleted: true });

  if (!existingTestimonial) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No testimonial found with id ${id}`,
      }),
      404
    );
  }

  if (existingTestimonial.isDeleted) {
    return c.json(
      createErrorResponse({
        error: "Already Deleted",
        message: `Testimonial with id ${id} is already deleted.`,
      }),
      400
    );
  }

  const [deletedTestimonial] = await db
    .update(testimonial)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: user?.id ?? null,
    })
    .where(eq(testimonial.id, id))
    .returning();

  return c.json(createSuccessResponse(deletedTestimonial), 200);
});
