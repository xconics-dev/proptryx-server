import { company_request, gstInfoResponseSchema } from "@proptryx/database";
import {
  createDbInsertSchema,
  createDbSelectSchema,
  createListQuerySchema,
  createListResponseSchema,
  optionalBooleanQuerySchema,
} from "@proptryx/utils";
import { z } from "@hono/zod-openapi";

export const companyRequestBaseSchema = createDbSelectSchema(company_request);

export const companyRequestSchema = companyRequestBaseSchema.extend({
  gst_details: gstInfoResponseSchema,
});

export const companyRequestListItemSchema = companyRequestBaseSchema;

export const companyRequestCreateSchema = createDbInsertSchema(company_request, {
  omit: [
    "id",
    "createdAt",
    "createdByUser",
    "updatedByUser",
    "updatedAt",
    "isDeleted",
    "deletedByUser",
    "deletedAt",
  ] as const,
});

export const companyRequestListSortFields = [
  "id",
  "ownerName",
  "ownerEmail",
  "ownerPhoneNumber",
  "companyGstNumber",
  "companyEmail",
  "createdAt",
  "updatedAt",
] as const;

export const companyRequestListQuerySchema = createListQuerySchema({
  sortFields: companyRequestListSortFields,
  extraShape: {
    includeDeleted: optionalBooleanQuerySchema,
  },
});

export type CompanyRequestListQuery = typeof companyRequestListQuerySchema._output;

export const companyRequestListResponseSchema = createListResponseSchema(
  companyRequestListItemSchema
);

export const companyRequestPermanentDeleteResultSchema = z.object({
  message: z.string(),
});
