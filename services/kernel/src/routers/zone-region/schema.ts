import { region, zone } from "@proptryx/database";
import {
  createDbInsertSchema,
  createDbSelectSchema,
  createDbUpdateSchema,
  createListQuerySchema,
  createListResponseSchema,
  optionalBooleanQuerySchema,
} from "@proptryx/utils";
import { z } from "@hono/zod-openapi";

export const regionSchema = createDbSelectSchema(region);
export const zoneSchema = createDbSelectSchema(zone);

export const regionWithZonesSchema = regionSchema.extend({
  zones: z.array(zoneSchema).default([]),
});

export const zoneWithRegionSchema = zoneSchema.extend({
  region: regionSchema.optional(),
  userCount: z.number().int().min(0).default(0),
});

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
  extraShape: {
    includeZones: optionalBooleanQuerySchema.default(true),
  },
});

export type RegionListQuery = z.infer<typeof regionListQuerySchema>;

export const regionGetQuerySchema = z.object({
  includeZones: optionalBooleanQuerySchema.default(true),
});

export const regionListResponseSchema = createListResponseSchema(regionWithZonesSchema);

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
    includeRegion: optionalBooleanQuerySchema.default(true),
  },
});

export type ZoneListQuery = z.infer<typeof zoneListQuerySchema>;

export const zoneGetQuerySchema = z.object({
  includeRegion: optionalBooleanQuerySchema.default(true),
});

export const zoneListResponseSchema = createListResponseSchema(zoneWithRegionSchema);
