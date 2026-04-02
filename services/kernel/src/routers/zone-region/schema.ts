import { region, zone } from "@proptryx/database";
import {
  createDbInsertSchema,
  createDbSelectSchema,
  createDbUpdateSchema,
  createListQuerySchema,
  createListResponseSchema,
} from "@proptryx/utils";
import { z } from "@hono/zod-openapi";

export const regionSchema = createDbSelectSchema(region);

export const regionCreateSchema = createDbInsertSchema(region, {
  omit: [
    "id",
    "createdAt",
    "updatedAt",
    "isDeleted",
    "deletedAt",
    "deletedByUser",
    "createdByUser",
    "updatedByUser",
  ],
});

export const regionUpdateSchema = createDbUpdateSchema(region, {
  omit: [
    "id",
    "createdAt",
    "updatedAt",
    "isDeleted",
    "deletedAt",
    "deletedByUser",
    "createdByUser",
    "updatedByUser",
  ],
});

export const regionListSortFields = ["id", "name", "createdAt", "updatedAt"] as const;

export const regionListQuerySchema = createListQuerySchema({
  sortFields: regionListSortFields,
});

export type RegionListQuery = z.infer<typeof regionListQuerySchema>;

export const regionListResponseSchema = createListResponseSchema(regionSchema);

export const zoneSchema = createDbSelectSchema(zone);

export const zoneCreateSchema = createDbInsertSchema(zone, {
  omit: [
    "id",
    "createdAt",
    "updatedAt",
    "isDeleted",
    "deletedAt",
    "deletedByUser",
    "createdByUser",
    "updatedByUser",
  ],
});

export const zoneUpdateSchema = createDbUpdateSchema(zone, {
  omit: [
    "id",
    "createdAt",
    "updatedAt",
    "isDeleted",
    "deletedAt",
    "deletedByUser",
    "createdByUser",
    "updatedByUser",
  ],
});

export const zoneListSortFields = ["id", "name", "regionId", "createdAt", "updatedAt"] as const;

export const zoneListQuerySchema = createListQuerySchema({
  sortFields: zoneListSortFields,
  extraShape: {
    regionId: z.string().optional(),
  },
});

export type ZoneListQuery = z.infer<typeof zoneListQuerySchema>;

export const zoneListResponseSchema = createListResponseSchema(zoneSchema);
