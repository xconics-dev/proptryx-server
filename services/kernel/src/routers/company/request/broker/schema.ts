import { broker_request } from "@proptryx/database";
import {
  createDbInsertSchema,
  createDbSelectSchema,
  createListQuerySchema,
  createListResponseSchema,
  optionalBooleanQuerySchema,
} from "@proptryx/utils";
import { z } from "@hono/zod-openapi";

export const brokerRequestBaseSchema = createDbSelectSchema(broker_request);

export const brokerRequestListItemSchema = brokerRequestBaseSchema;

export const brokerRequestCreateSchema = createDbInsertSchema(broker_request, {
  omit: [
    "id",
    "createdAt",
    "createdByUser",
    "updatedByUser",
    "updatedAt",
    "isDeleted",
    "deletedByUser",
    "deletedAt",
  ] as const,
});

export const brokerRequestListSortFields = [
  "id",
  "name",
  "email",
  "phoneNumber",
  "pincode",
  "createdAt",
  "updatedAt",
] as const;

export const brokerRequestListQuerySchema = createListQuerySchema({
  sortFields: brokerRequestListSortFields,
  extraShape: {
    includeDeleted: optionalBooleanQuerySchema,
  },
});

export type BrokerRequestListQuery = typeof brokerRequestListQuerySchema._output;

export const brokerRequestListResponseSchema = createListResponseSchema(
  brokerRequestListItemSchema
);

export const brokerRequestPermanentDeleteResultSchema = z.object({
  message: z.string(),
});
