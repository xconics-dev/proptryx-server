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
      propertyId: zod.string("Invalid propertyId").trim().min(1, "Property id is required"),
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
      propertyId: zod
        .string("Invalid propertyId")
        .trim()
        .min(1, "Property id is required")
        .optional(),
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
    includeDeleted: optionalBooleanQuerySchema,
    isArchived: optionalBooleanQuerySchema,
    propertyId: zod.string("Invalid propertyId").optional(),
    createdByUser: zod.string("Invalid createdByUser").optional(),
    propertyOrganizationId: zod.string("Invalid propertyOrganizationId").optional(),
    propertyCreatedByUser: zod.string("Invalid propertyCreatedByUser").optional(),
    propertyOwnerUserId: zod.string("Invalid propertyOwnerUserId").optional(),
  },
});

export type FaqListQuery = z.infer<typeof faqListQuerySchema>;

export const faqListResponseSchema = createListResponseSchema(faqSchema);

export const faqPermanentDeleteResultSchema = zod.object({
  message: zod.string(),
});
