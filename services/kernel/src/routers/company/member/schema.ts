import { member } from "@proptryx/database";
import {
  createDbInsertSchema,
  createDbSelectSchema,
  createDbUpdateSchema,
  createListQuerySchema,
} from "@proptryx/utils";
import z from "zod";

export const memberSchema = createDbSelectSchema(member);

export const memberCreateSchema = createDbInsertSchema(member, {
  omit: [
    "id",
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
  omit: [
    "id",
    "organizationId",
    "createdAt",
    "updatedAt",
    "deletedAt",
    "createdByUser",
    "updatedByUser",
    "deletedByUser",
  ],
});

export const memberListQuerySchema = createListQuerySchema({
  sortFields: ["name", "email", "createdAt"],
  extraShape: {
    role: z.string().optional(),
  },
});

export type memberListQuery = z.infer<typeof memberListQuerySchema>;

export const memberListResponseSchema = createDbSelectSchema(member);
