import { getDB, region, zone } from "@proptryx/database";
import { createTableListFetcher } from "@proptryx/utils";
import { eq } from "drizzle-orm";
import type { RegionListQuery, ZoneListQuery } from "./schema";

export const fetchRegionList = createTableListFetcher<
  typeof region,
  typeof region.$inferSelect,
  RegionListQuery
>({
  db: getDB,
  table: region,
  where: eq(region.isDeleted, false),
  search: {
    exact: [region.id],
    prefix: [region.name],
    contains: [region.description],
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    id: region.id,
    name: region.name,
    createdAt: region.createdAt,
    updatedAt: region.updatedAt,
  },
});

export const fetchZoneList = createTableListFetcher<
  typeof zone,
  typeof zone.$inferSelect,
  ZoneListQuery
>({
  db: getDB,
  table: zone,
  where: eq(zone.isDeleted, false),
  search: {
    exact: [zone.id, zone.regionId],
    prefix: [zone.name],
    contains: [zone.description],
  },
  filterColumns: {
    regionId: zone.regionId,
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    id: zone.id,
    name: zone.name,
    regionId: zone.regionId,
    createdAt: zone.createdAt,
    updatedAt: zone.updatedAt,
  },
});
