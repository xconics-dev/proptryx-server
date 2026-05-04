import { faq } from "@proptryx/database";
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

export const faqSchema = createDbSelectSchema(faq);

export const faqCreateSchema = createDbInsertSchema(faq, {
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
      propertyId: zod.string("Invalid propertyId").optional().nullable(),
    });
  },
});

export const faqUpdateSchema = createDbUpdateSchema(faq, {
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
      propertyId: zod.string("Invalid propertyId").optional().nullable(),
    });
  },
});

export const faqListSortFields = [
  "id",
  "propertyId",
  "question",
  "isArchived",
  "createdAt",
  "updatedAt",
] as const;

export const faqListQuerySchema = createListQuerySchema({
  sortFields: faqListSortFields,
  extraShape: {
    isArchived: optionalBooleanQuerySchema,
    propertyId: zod.string("Invalid propertyId").optional(),
  },
});

export type FaqListQuery = z.infer<typeof faqListQuerySchema>;

export const faqListResponseSchema = createListResponseSchema(faqSchema);
