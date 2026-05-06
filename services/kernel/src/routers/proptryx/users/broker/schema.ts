import { user } from "@proptryx/database";
import {
  createDbInsertSchema,
  createDbUpdateSchema,
  createListQuerySchema,
  createListResponseSchema,
} from "@proptryx/utils";
import z from "zod";
import { proptryxUserSchema, proptryxUserWithLocationSchema } from "../schema";

export const proptryxBrokerUserSchema = proptryxUserSchema;

export const proptryxBrokerUserWithLocationSchema = proptryxUserWithLocationSchema;

export const proptryxBrokerUserCreateSchema = createDbInsertSchema(user, {
  omit: [
    "id",
    "panel",
    "role",
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
      image: z.url("Invalid URL").optional(),
      phoneNumber: z.string().optional(),
      zoneId: z.string().optional(),
    });
  },
});

export const proptryxBrokerUserUpdateSchema = createDbUpdateSchema(user, {
  omit: [
    "id",
    "panel",
    "role",
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
      image: z.url("Invalid URL").optional().nullable(),
      phoneNumber: z.string().optional().nullable(),
      zoneId: z.string().optional().nullable(),
    });
  },
});

export const proptryxBrokerUserListQuerySchema = createListQuerySchema({
  sortFields: ["name", "email", "role", "zone", "region", "createdAt", "updatedAt"],
  extraShape: {
    zoneId: z.string().optional(),
    regionId: z.string().optional(),
  },
});

export type ProptryxBrokerUserListQuery = z.infer<typeof proptryxBrokerUserListQuerySchema>;
export type ScopedProptryxBrokerUserListQuery = ProptryxBrokerUserListQuery & {
  excludeUserId?: string;
};

export const proptryxBrokerUserListResponseSchema = createListResponseSchema(
  proptryxBrokerUserWithLocationSchema
);

export const proptryxBrokerUserPermanentDeleteResultSchema = z.object({
  message: z.string(),
});
