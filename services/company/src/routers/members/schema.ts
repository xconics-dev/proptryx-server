import { member, user } from "@proptryx/database";
import {
  createDbInsertSchema,
  createDbSelectSchema,
  createDbUpdateSchema,
  createListQuerySchema,
  createListResponseSchema,
} from "@proptryx/utils";
import z from "zod";

export const memberSchema = createDbSelectSchema(member);

export const memberListItemSchema = memberSchema.extend({
  user: createDbSelectSchema(user),
});

export const memberCreateSchema = createDbInsertSchema(member, {
  omit: [
    "id",
    "userId",
    "organizationId",
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

export const memberListQuerySchema = createListQuerySchema({
  sortFields: ["name", "email", "createdAt"],
  extraShape: {
    role: z.string().optional(),
    panel: z.string().optional(),
  },
});

export type MemberListQuery = z.infer<typeof memberListQuerySchema>;
export type ScopedMemberListQuery = MemberListQuery & {
  organizationId?: string;
};

export const memberListResponseSchema = createListResponseSchema(memberListItemSchema);
