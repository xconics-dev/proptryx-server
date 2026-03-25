import { company_request, gstInfoResponseSchema } from "@proptryx/database";
import { createDbInsertSchema, createDbSelectSchema } from "@proptryx/utils";

export const companyRequestSchema = createDbSelectSchema(company_request, {
  customizeSchema(schema) {
    return schema.extend({
      gst_details: gstInfoResponseSchema,
    });
  },
});

export const companyRequestCreateSchema = createDbInsertSchema(company_request, {
  omit: ["id"],
});
