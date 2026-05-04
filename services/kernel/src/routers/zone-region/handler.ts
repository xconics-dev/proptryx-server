import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import { db, region, zone } from "@proptryx/database";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@proptryx/utils";
import { eq } from "drizzle-orm";
import {
  createRegion,
  createZone,
  getRegion,
  getZone,
  listRegions,
  listZones,
  removeRegion,
  removeZone,
  updateRegion,
  updateZone,
} from "./openapi.route";
import { fetchRegionList, fetchZoneList } from "./list";
import {
  attachRegionToZones,
  attachUserCountsToZones,
  attachZonesToRegions,
  findActiveZoneByRegionId,
  findRegionById,
  findRegionByName,
  findZoneById,
  findZoneByRegionAndName,
} from "./utils";

export const zoneRegionGroup = new OpenAPIHono<AppBindings>();

registerOpenApiRoute(zoneRegionGroup, listRegions, async (c) => {
  const query = c.req.valid("query");
  const response = await fetchRegionList(query);
  const items = await attachZonesToRegions(response.items, {
    includeZones: query.includeZones,
  });

  return c.json(createSuccessResponse({ ...response, items }), 200);
});

registerOpenApiRoute(zoneRegionGroup, getRegion, async (c) => {
  const { id } = c.req.valid("param");
  const query = c.req.valid("query");
  const regionData = await findRegionById(id);

  if (!regionData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No region found with id ${id}`,
      }),
      404
    );
  }

  const [regionWithZones] = await attachZonesToRegions([regionData], {
    includeZones: query.includeZones,
  });

  return c.json(createSuccessResponse(regionWithZones), 200);
});

registerOpenApiRoute(zoneRegionGroup, createRegion, async (c) => {
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);

  const existingRegion = await findRegionByName(body.name);

  if (existingRegion) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "Region with this name already exists",
      }),
      409
    );
  }

  const [createdRegion] = await db
    .insert(region)
    .values({
      id: generateRandomId(),
      createdByUser: user?.id ?? null,
      ...body,
    })
    .returning();

  return c.json(createSuccessResponse(createdRegion), 201);
});

registerOpenApiRoute(zoneRegionGroup, updateRegion, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);

  const existingRegion = await findRegionById(id);

  if (!existingRegion) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No region found with id ${id}`,
      }),
      404
    );
  }

  if (body.name) {
    const duplicateRegion = await findRegionByName(body.name, { excludeId: id });

    if (duplicateRegion) {
      return c.json(
        createErrorResponse({
          error: "Conflict",
          message: "Region with this name already exists",
        }),
        409
      );
    }
  }

  const [updatedRegion] = await db
    .update(region)
    .set({ ...body, updatedByUser: user?.id ?? null })
    .where(eq(region.id, id))
    .returning();

  return c.json(createSuccessResponse(updatedRegion), 200);
});

registerOpenApiRoute(zoneRegionGroup, removeRegion, async (c) => {
  const { id } = c.req.valid("param");
  const { user } = getBetterAuthContext(c);

  const existingRegion = await findRegionById(id);

  if (!existingRegion) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No region found with id ${id}`,
      }),
      404
    );
  }

  const activeZone = await findActiveZoneByRegionId(id);

  if (activeZone) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "Cannot delete region while active zones exist",
      }),
      409
    );
  }

  await db
    .update(region)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: user?.id ?? null,
    })
    .where(eq(region.id, id));

  const deletedRegion = await findRegionById(id, { includeDeleted: true });

  return c.json(createSuccessResponse(deletedRegion ?? existingRegion), 200);
});

registerOpenApiRoute(zoneRegionGroup, listZones, async (c) => {
  const query = c.req.valid("query");
  const response = await fetchZoneList(query);
  const zonesWithRegion = await attachRegionToZones(response.items, {
    includeRegion: query.includeRegion,
  });
  const items = await attachUserCountsToZones(zonesWithRegion);

  return c.json(createSuccessResponse({ ...response, items }), 200);
});

registerOpenApiRoute(zoneRegionGroup, getZone, async (c) => {
  const { id } = c.req.valid("param");
  const query = c.req.valid("query");
  const zoneData = await findZoneById(id);

  if (!zoneData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No zone found with id ${id}`,
      }),
      404
    );
  }

  const zonesWithRegion = await attachRegionToZones([zoneData], {
    includeRegion: query.includeRegion,
  });
  const [zoneWithRegion] = await attachUserCountsToZones(zonesWithRegion);

  return c.json(createSuccessResponse(zoneWithRegion), 200);
});

registerOpenApiRoute(zoneRegionGroup, createZone, async (c) => {
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);

  const [regionData, existingZone] = await Promise.all([
    findRegionById(body.regionId),
    findZoneByRegionAndName(body.regionId, body.name),
  ]);

  if (!regionData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No region found with id ${body.regionId}`,
      }),
      404
    );
  }

  if (existingZone) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "Zone with this name already exists in the region",
      }),
      409
    );
  }

  const [createdZone] = await db
    .insert(zone)
    .values({
      id: generateRandomId(),
      ...body,
      createdByUser: user?.id ?? null,
    })
    .returning();

  return c.json(createSuccessResponse(createdZone), 201);
});

registerOpenApiRoute(zoneRegionGroup, updateZone, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);

  const existingZone = await findZoneById(id);

  if (!existingZone) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No zone found with id ${id}`,
      }),
      404
    );
  }

  const nextRegionId = body.regionId ?? existingZone.regionId;
  const nextName = body.name ?? existingZone.name;

  const [regionData, duplicateZone] = await Promise.all([
    findRegionById(nextRegionId),
    findZoneByRegionAndName(nextRegionId, nextName, { excludeId: id }),
  ]);

  if (!regionData) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No region found with id ${nextRegionId}`,
      }),
      404
    );
  }

  if (duplicateZone) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "Zone with this name already exists in the region",
      }),
      409
    );
  }

  const [updatedZone] = await db
    .update(zone)
    .set({ ...body, updatedByUser: user?.id ?? null })
    .where(eq(zone.id, id))
    .returning();

  return c.json(createSuccessResponse(updatedZone), 200);
});

registerOpenApiRoute(zoneRegionGroup, removeZone, async (c) => {
  const { id } = c.req.valid("param");
  const { user } = getBetterAuthContext(c);

  const existingZone = await findZoneById(id);

  if (!existingZone) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: `No zone found with id ${id}`,
      }),
      404
    );
  }

  await db
    .update(zone)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: user?.id ?? null,
    })
    .where(eq(zone.id, id));

  const deletedZone = await findZoneById(id, { includeDeleted: true });

  return c.json(createSuccessResponse(deletedZone ?? existingZone), 200);
});
