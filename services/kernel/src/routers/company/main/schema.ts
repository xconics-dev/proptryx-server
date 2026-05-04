import {
  gstInfoResponseSchema,
  member,
  organization,
  OrganizationType,
  rbacRole,
} from "@proptryx/database";
import {
  createDbInsertSchema,
  createDbSelectSchema,
  createDbUpdateSchema,
  createListQuerySchema,
  createListResponseSchema,
  optionalBooleanQuerySchema,
} from "@proptryx/utils";
import { z } from "@hono/zod-openapi";

export const companySchema = createDbSelectSchema(organization).extend({
  roles: z.array(
    createDbSelectSchema(rbacRole, {
      omit: ["createdAt", "updatedAt", "organizationId"],
    })
  ),
});

const companyUserSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  phoneNumber: z.string().nullable(),
  emailVerified: z.boolean(),
});

const companyAdminUserSummarySchema = companyUserSummarySchema.nullable();

const companyCurrentMemberSchema = createDbSelectSchema(member, {
  omit: ["deletedAt", "isDeleted", "deletedByUser"],
})
  .extend({
    user: companyUserSummarySchema,
  })
  .nullable();

export const companySettingsSchema = createDbSelectSchema(organization).extend({
  createdByUserAdmin: companyAdminUserSummarySchema,
  updatedByUserAdmin: companyAdminUserSummarySchema,
  currentMember: companyCurrentMemberSchema,
});

export const companyCreateSchema = createDbInsertSchema(organization, {
  omit: [
    "id",
    "createdAt",
    "updatedAt",
    "razorpayCustomerId",
    "deletedAt",
    "isDeleted",
    "updatedByUser",
    "deletedByUser",
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

export const companyAddNewSchema = companyCreateSchema
  .omit({
    ownerName: true,
    ownerEmail: true,
    ownerPhoneNumber: true,
    ownerZoneId: true,
  })
  .extend({
    requestId: z.string().min(1, "Request id is required"),
  });

export const COMPANY_CREATION_STEPS = [
  "validate_input",
  "insert_user",
  "insert_credential_account",
  "resolve_existing_user",
  "insert_organization",
  "insert_member",
] as const;

export const STANDARD_COMPANY_CREATION_STEPS = [
  "validate_input",
  "insert_user",
  "insert_credential_account",
  "insert_organization",
  "insert_member",
] as const satisfies readonly (typeof COMPANY_CREATION_STEPS)[number][];

export const ADD_NEW_COMPANY_CREATION_STEPS = [
  "validate_input",
  "resolve_existing_user",
  "insert_organization",
  "insert_member",
] as const satisfies readonly (typeof COMPANY_CREATION_STEPS)[number][];

export type CompanyCreationStep = (typeof COMPANY_CREATION_STEPS)[number];
export const COMPANY_CREATION_TOTAL_STEPS = STANDARD_COMPANY_CREATION_STEPS.length;
export const ADD_NEW_COMPANY_CREATION_TOTAL_STEPS = ADD_NEW_COMPANY_CREATION_STEPS.length;

export const companyCreateResponseSchema = z.object({
  company: companySchema,
  owner: z.object({
    id: z.string(),
    name: z.string(),
    email: z.email(),
    emailVerified: z.boolean(),
    phoneNumber: z.string().nullable(),
  }),
  completedSteps: z.number(),
  totalSteps: z.number(),
  stepsCompleted: z.array(z.enum(COMPANY_CREATION_STEPS)),
  stepsFailed: z.array(z.enum(COMPANY_CREATION_STEPS)),
});

export const companyUpdateSchema = createDbUpdateSchema(organization, {
  omit: [
    "id",
    "slug",
    "createdAt",
    "updatedAt",
    "razorpayCustomerId",
    "deletedAt",
    "isDeleted",
    "deletedByUser",
    "createdByUser",
    "updatedByUser",
  ],
});

export const companyGstInfoSchema = z.object(gstInfoResponseSchema.shape);

const companyOwnerSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.email(),
  emailVerified: z.boolean(),
  phoneNumber: z.string().nullable(),
});

const companyActiveSubscriptionSchema = z.object({
  planName: z.string(),
  status: z.string(),
});

export const companyListItemSchema = createDbSelectSchema(organization).extend({
  owner: companyOwnerSummarySchema.nullable(),
  memberCount: z.number(),
  propertyCount: z.number(),
  activeSubscription: companyActiveSubscriptionSchema.nullable(),
});

export const companyListSortFields = [
  "id",
  "name",
  "email",
  "phoneNumber",
  "isActive",
  "createdAt",
  "updatedAt",
] as const;

export const companyListQuerySchema = createListQuerySchema({
  sortFields: companyListSortFields,
  extraShape: {
    isActive: optionalBooleanQuerySchema,
    type: z.enum(OrganizationType.enumValues).optional(),
    companyType: z.string().optional(),
    industry: z.string().optional(),
    subscriptionPlanId: z.string().optional(),
  },
});
export type CompanyListQuery = z.infer<typeof companyListQuerySchema>;

export const companyListResponseSchema = createListResponseSchema(companyListItemSchema);
