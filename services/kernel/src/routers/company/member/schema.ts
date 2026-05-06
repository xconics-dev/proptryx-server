import { member, user } from "@proptryx/database";
import {
  createDbInsertSchema,
  createDbSelectSchema,
  createDbUpdateSchema,
  IdStringParamSchema,
  createListQuerySchema,
  createListResponseSchema,
} from "@proptryx/utils";
import z from "zod";

export const memberSchema = createDbSelectSchema(member);

export const memberListUserSchema = createDbSelectSchema(user).extend({
  zone: z.string().nullable(),
  region: z.string().nullable(),
});

export const memberListItemSchema = memberSchema.extend({
  user: memberListUserSchema,
});

export const memberCreateSchema = createDbInsertSchema(member, {
  omit: [
    "id",
    "userId",
    "panel",
    "isDeleted",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "createdByUser",
    "updatedByUser",
    "deletedByUser",
  ],
  customizeSchema(schema) {
    return schema.extend({
      email: z.email("Invalid email address"),
      name: z.string().min(1, "Name is required"),
      phoneNumber: z.string().optional(),
      zoneId: z.string(),
    });
  },
});

export const memberUpdateSchema = createDbUpdateSchema(member, {
  customizeSchema(schema) {
    return schema
      .pick({
        role: true,
      })
      .extend({
        name: z.string().min(1, "Name is required").optional(),
        image: z.url("Invalid URL").optional(),
        email: z.email("Invalid email address").optional(),
        phoneNumber: z.string().optional(),
        zoneId: z.string().optional(),
      });
  },
});

export const memberBanSchema = z.object({
  reason: z.string().trim().min(1, "Ban reason is required"),
});

export const memberListParamsSchema = IdStringParamSchema("companyId");

export const memberListQuerySchema = createListQuerySchema({
  sortFields: ["name", "email", "role", "zone", "region", "createdAt", "updatedAt"],
  extraShape: {
    role: z.string().optional(),
    panel: z.string().optional(),
    zoneId: z.string().optional(),
    regionId: z.string().optional(),
    emailVerified: z.coerce.boolean().optional(),
  },
});

export const memberDeleteWithUserResultSchema = z.object({
  message: z.string(),
});

export const memberRemoveResultSchema = z.object({
  message: z.string(),
});

export type MemberListQuery = z.infer<typeof memberListQuerySchema>;
export type ScopedMemberListQuery = MemberListQuery & {
  organizationId?: string;
};

export const memberListResponseSchema = createListResponseSchema(memberListItemSchema);
