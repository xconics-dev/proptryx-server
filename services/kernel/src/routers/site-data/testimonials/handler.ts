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
import { eq } from "drizzle-orm";
import { create, get, list, remove, removePermanently, restore, update } from "./openapi.route";
import { fetchTestimonialList } from "./list";
import { findActivePropertyById, findTestimonialById } from "./utils";

export const testimonialsGroup = new OpenAPIHono<AppBindings>();

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

  if (body.propertyId !== undefined && body.propertyId !== null) {
    const linkedProperty = await findActivePropertyById(body.propertyId);

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

  if (body.propertyId !== undefined && body.propertyId !== null) {
    const linkedProperty = await findActivePropertyById(body.propertyId);

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

registerOpenApiRoute(testimonialsGroup, restore, async (c) => {
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

  if (!existingTestimonial.isDeleted) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: `Testimonial with id ${id} is already active.`,
      }),
      409
    );
  }

  const [restoredTestimonial] = await db
    .update(testimonial)
    .set({
      isDeleted: false,
      deletedAt: null,
      deletedByUser: null,
      updatedByUser: user?.id ?? null,
    })
    .where(eq(testimonial.id, id))
    .returning();

  return c.json(createSuccessResponse(restoredTestimonial), 200);
});

registerOpenApiRoute(testimonialsGroup, removePermanently, async (c) => {
  const { id } = c.req.valid("param");
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

  await db.delete(testimonial).where(eq(testimonial.id, id));

  return c.json(
    createSuccessResponse({
      message: "Testimonial permanently deleted successfully",
    }),
    200
  );
});
