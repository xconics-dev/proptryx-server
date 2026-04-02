import { testimonial } from "@proptryx/database";
import {
  createDbInsertSchema,
  createDbSelectSchema,
  createDbUpdateSchema,
  createListQuerySchema,
  createListResponseSchema,
  optionalBooleanQuerySchema,
} from "@proptryx/utils";
import type { z } from "@hono/zod-openapi";

export const testimonialSchema = createDbSelectSchema(testimonial);

export const testimonialCreateSchema = createDbInsertSchema(testimonial, {
  omit: [
    "id",
    "createdAt",
    "updatedAt",
    "isDeleted",
    "deletedAt",
    "createdByUser",
    "updatedByUser",
    "deletedByUser",
  ],
});

export const testimonialUpdateSchema = createDbUpdateSchema(testimonial, {
  omit: [
    "id",
    "createdAt",
    "updatedAt",
    "isDeleted",
    "deletedAt",
    "createdByUser",
    "updatedByUser",
    "deletedByUser",
  ],
});

export const testimonialListSortFields = [
  "id",
  "authorName",
  "designation",
  "ratings",
  "isArchived",
  "createdAt",
  "updatedAt",
] as const;

export const testimonialListQuerySchema = createListQuerySchema({
  sortFields: testimonialListSortFields,
  extraShape: {
    isArchived: optionalBooleanQuerySchema,
  },
});

export type TestimonialListQuery = z.infer<typeof testimonialListQuerySchema>;

export const testimonialListResponseSchema = createListResponseSchema(testimonialSchema);
