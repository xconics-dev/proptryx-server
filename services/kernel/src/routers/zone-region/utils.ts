import { db, region, zone } from "@proptryx/database";
import { and, eq, inArray, ne } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

type RegionLookupOptions = {
  excludeId?: string;
};

type AttachZonesOptions = {
  includeZones?: boolean;
};

type AttachRegionOptions = {
  includeRegion?: boolean;
};

export async function findRegionById(id: string, options?: IncludeDeletedOptions) {
  const whereClause = options?.includeDeleted
    ? eq(region.id, id)
    : and(eq(region.id, id), eq(region.isDeleted, false));

  return db
    .select()
    .from(region)
    .where(whereClause)
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findZoneById(id: string, options?: IncludeDeletedOptions) {
  const whereClause = options?.includeDeleted
    ? eq(zone.id, id)
    : and(eq(zone.id, id), eq(zone.isDeleted, false));

  return db
    .select()
    .from(zone)
    .where(whereClause)
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findRegionByName(name: string, options?: RegionLookupOptions) {
  const clauses = [eq(region.name, name), eq(region.isDeleted, false)];

  if (options?.excludeId) {
    clauses.push(ne(region.id, options.excludeId));
  }

  return db
    .select({ id: region.id })
    .from(region)
    .where(and(...clauses))
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findZoneByRegionAndName(
  regionId: string,
  name: string,
  options?: RegionLookupOptions
) {
  const clauses = [eq(zone.regionId, regionId), eq(zone.name, name), eq(zone.isDeleted, false)];

  if (options?.excludeId) {
    clauses.push(ne(zone.id, options.excludeId));
  }

  return db
    .select({ id: zone.id })
    .from(zone)
    .where(and(...clauses))
    .limit(1)
    .then((rows) => rows[0]);
}

export async function findActiveZoneByRegionId(regionId: string) {
  return db
    .select({ id: zone.id })
    .from(zone)
    .where(and(eq(zone.regionId, regionId), eq(zone.isDeleted, false)))
    .limit(1)
    .then((rows) => rows[0]);
}

export async function attachZonesToRegions<TRegion extends { id: string }>(
  regionsData: TRegion[],
  options?: AttachZonesOptions
) {
  if (!options?.includeZones || regionsData.length === 0) {
    return regionsData;
  }

  const regionIds = regionsData.map((item) => item.id);
  const zonesData = await db
    .select()
    .from(zone)
    .where(and(inArray(zone.regionId, regionIds), eq(zone.isDeleted, false)));

  const zonesByRegionId = new Map<string, typeof zonesData>();
  for (const zoneData of zonesData) {
    const regionZones = zonesByRegionId.get(zoneData.regionId) ?? [];
    regionZones.push(zoneData);
    zonesByRegionId.set(zoneData.regionId, regionZones);
  }

  return regionsData.map((regionData) => ({
    ...regionData,
    zones: zonesByRegionId.get(regionData.id) ?? [],
  }));
}

export async function attachRegionToZones<TZone extends { regionId: string }>(
  zonesData: TZone[],
  options?: AttachRegionOptions
) {
  if (!options?.includeRegion || zonesData.length === 0) {
    return zonesData;
  }

  const regionIds = [...new Set(zonesData.map((item) => item.regionId))];
  const regionsData = await db
    .select()
    .from(region)
    .where(and(inArray(region.id, regionIds), eq(region.isDeleted, false)));

  const regionById = new Map(regionsData.map((regionData) => [regionData.id, regionData]));

  return zonesData.map((zoneData) => ({
    ...zoneData,
    region: regionById.get(zoneData.regionId),
  }));
}
