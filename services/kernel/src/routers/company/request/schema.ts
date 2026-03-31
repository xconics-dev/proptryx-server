import { company_request, gstInfoResponseSchema } from "@proptryx/database";
import { createDbInsertSchema, createDbSelectSchema } from "@proptryx/utils";

export const companyRequestBaseSchema = createDbSelectSchema(company_request);

export const companyRequestSchema = companyRequestBaseSchema.extend({
  gst_details: gstInfoResponseSchema,
});

export const companyRequestCreateSchema = createDbInsertSchema(company_request, {
  omit: ["id", "createdAt", "updatedAt", "isDeleted", "deletedByUser", "deletedAt"] as const,
});
