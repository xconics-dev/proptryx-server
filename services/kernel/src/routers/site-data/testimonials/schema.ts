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
import zod from "zod";

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
  customizeSchema(schema) {
    return schema.extend({
      propertyId: zod.string("Invalid propertyId").trim().min(1, "Property id is required"),
    });
  },
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
  customizeSchema(schema) {
    return schema.extend({
      propertyId: zod
        .string("Invalid propertyId")
        .trim()
        .min(1, "Property id is required")
        .optional(),
    });
  },
});

export const testimonialListSortFields = [
  "id",
  "propertyId",
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
    includeDeleted: optionalBooleanQuerySchema,
    isArchived: optionalBooleanQuerySchema,
    propertyId: zod.string().optional(),
    createdByUser: zod.string().optional(),
    propertyOrganizationId: zod.string().optional(),
    propertyCreatedByUser: zod.string().optional(),
    propertyOwnerUserId: zod.string().optional(),
  },
});

export type TestimonialListQuery = z.infer<typeof testimonialListQuerySchema>;

export const testimonialListResponseSchema = createListResponseSchema(testimonialSchema);

export const testimonialPermanentDeleteResultSchema = zod.object({
  message: zod.string(),
});
