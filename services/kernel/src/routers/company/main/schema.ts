import { organization } from "@proptryx/database";
import { createDbInsertSchema, createDbSelectSchema } from "@proptryx/utils";
import z from "zod";

export const companySchema = createDbSelectSchema(organization);

export const companyCreateSchema = createDbInsertSchema(organization, {
  omit: [
    "id",
    "createdAt",
    "updatedAt",
    "razorpayCustomerId",
    "deletedAt",
    "isDeleted",
    "deletedByUser",
    "logo",
    "metadata",
    "createdByUser",
  ],
  customizeSchema(schema) {
    return schema.extend({
      ownerName: z.string().min(1, "Owner name is required"),
      ownerEmail: z.email("Invalid email address"),
      ownerPhoneNumber: z.string().optional(),
      ownerZoneId: z.string(),
    });
  },
});

export const COMPANY_CREATION_STEPS = [
  "validate_input",
  "insert_user",
  "insert_credential_account",
  "insert_organization",
  "insert_member",
] as const;

export type CompanyCreationStep = (typeof COMPANY_CREATION_STEPS)[number];
export const COMPANY_CREATION_TOTAL_STEPS = COMPANY_CREATION_STEPS.length;

export const companyCreateResponseSchema = z.object({
  company: companySchema,
  owner: z.object({
    id: z.string(),
    name: z.string(),
    email: z.email(),
  }),
  completedSteps: z.number(),
  totalSteps: z.number(),
  stepsCompleted: z.array(z.enum(COMPANY_CREATION_STEPS)),
  stepsFailed: z.array(z.enum(COMPANY_CREATION_STEPS)),
});
