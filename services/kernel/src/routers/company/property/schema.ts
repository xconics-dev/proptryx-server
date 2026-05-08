import { PropertyStatus, PropertyType, organization, property, user } from "@proptryx/database";
import {
  createDbInsertSchema,
  createDbSelectSchema,
  createDbUpdateSchema,
  createListQuerySchema,
  createListResponseSchema,
  optionalBooleanQuerySchema,
} from "@proptryx/utils";
import { z } from "@hono/zod-openapi";

const propertyUserSummarySchema = createDbSelectSchema(user, {
  omit: [
    "image",
    "banned",
    "banReason",
    "banExpires",
    "phoneNumberVerified",
    "deletedAt",
    "createdAt",
    "updatedAt",
    "createdByUser",
    "updatedByUser",
    "deletedByUser",
    "isDeleted",
  ],
});

const propertyOrganizationSummarySchema = createDbSelectSchema(organization, {
  omit: ["metadata", "razorpayCustomerId", "createdAt", "updatedAt", "deletedAt", "deletedByUser"],
});

export const propertySchema = createDbSelectSchema(property);

export const propertyDetailSchema = propertySchema.extend({
  organization: propertyOrganizationSummarySchema.nullable(),
  superOwner: propertyUserSummarySchema.nullable(),
});

export const propertyCreateSchema = createDbInsertSchema(property, {
  omit: [
    "id",
    "createdAt",
    "updatedAt",
    "isDeleted",
    "deletedAt",
    "createdByUser",
    "updatedByUser",
    "deletedByUser",
  ],
  customizeSchema(schema) {
    return schema.extend({
      organizationId: z.string().min(1, "Organization id is required"),
    });
  },
});

export const propertyUpdateSchema = createDbUpdateSchema(property, {
  omit: [
    "id",
    "createdAt",
    "updatedAt",
    "isDeleted",
    "deletedAt",
    "createdByUser",
    "updatedByUser",
    "deletedByUser",
  ],
});

export const propertyListSortFields = [
  "id",
  "organizationId",
  "name",
  "type",
  "status",
  "city",
  "state",
  "isPublished",
  "isOperational",
  "createdAt",
  "updatedAt",
] as const;

export const propertyListQuerySchema = createListQuerySchema({
  sortFields: propertyListSortFields,
  extraShape: {
    organizationId: z.string().optional(),
    superOwnerId: z.string().optional(),
    type: z.enum(PropertyType.enumValues).optional(),
    status: z.enum(PropertyStatus.enumValues).optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    isPublished: optionalBooleanQuerySchema,
    isOperational: optionalBooleanQuerySchema,
    isVerified: optionalBooleanQuerySchema,
    includeDeleted: optionalBooleanQuerySchema,
  },
});

export type PropertyListQuery = z.infer<typeof propertyListQuerySchema>;

export const propertyGetQuerySchema = z.object({
  includeDeleted: optionalBooleanQuerySchema,
});

export const propertyListResponseSchema = createListResponseSchema(propertyDetailSchema);
