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
});

export const faqListSortFields = [
  "id",
  "question",
  "isArchived",
  "createdAt",
  "updatedAt",
] as const;

export const faqListQuerySchema = createListQuerySchema({
  sortFields: faqListSortFields,
  extraShape: {
    isArchived: optionalBooleanQuerySchema,
  },
});

export type FaqListQuery = z.infer<typeof faqListQuerySchema>;

export const faqListResponseSchema = createListResponseSchema(faqSchema);
