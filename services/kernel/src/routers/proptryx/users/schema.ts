import { user } from "@proptryx/database";
import {
  createDbInsertSchema,
  createDbSelectSchema,
  createDbUpdateSchema,
  createListQuerySchema,
  createListResponseSchema,
} from "@proptryx/utils";
import z from "zod";

export const proptryxUserSchema = createDbSelectSchema(user);

export const proptryxUserWithLocationSchema = proptryxUserSchema.extend({
  zone: z.string().nullable(),
  region: z.string().nullable(),
  pincode: z.string().nullable(),
});

export const proptryxUserCreateSchema = createDbInsertSchema(user, {
  omit: [
    "id",
    "panel",
    "emailVerified",
    "phoneNumberVerified",
    "banned",
    "banReason",
    "banExpires",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "createdByUser",
    "updatedByUser",
    "deletedByUser",
    "isDeleted",
  ],
  customizeSchema(schema) {
    return schema.extend({
      name: z.string().min(1, "Name is required"),
      email: z.email("Invalid email address"),
      role: z.string().min(1, "Role is required"),
      image: z.url("Invalid URL").optional(),
      phoneNumber: z.string().optional(),
      zoneId: z.string().optional(),
    });
  },
});

export const proptryxUserUpdateSchema = createDbUpdateSchema(user, {
  omit: [
    "id",
    "panel",
    "emailVerified",
    "phoneNumberVerified",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "createdByUser",
    "updatedByUser",
    "deletedByUser",
    "isDeleted",
  ],
  customizeSchema(schema) {
    return schema.extend({
      name: z.string().min(1, "Name is required").optional(),
      email: z.email("Invalid email address").optional(),
      role: z.string().min(1, "Role is required").optional(),
      image: z.url("Invalid URL").optional().nullable(),
      phoneNumber: z.string().optional().nullable(),
      zoneId: z.string().optional().nullable(),
    });
  },
});

export const proptryxUserListQuerySchema = createListQuerySchema({
  sortFields: ["name", "email", "role", "zone", "region", "createdAt", "updatedAt"],
  extraShape: {
    role: z.string().optional(),
    zoneId: z.string().optional(),
    regionId: z.string().optional(),
  },
});

export type ProptryxUserListQuery = z.infer<typeof proptryxUserListQuerySchema>;
export type ScopedProptryxUserListQuery = ProptryxUserListQuery & {
  excludeUserId?: string;
};

export const proptryxUserListResponseSchema = createListResponseSchema(
  proptryxUserWithLocationSchema
);
