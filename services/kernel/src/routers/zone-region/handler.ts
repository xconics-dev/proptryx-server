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
import { and, eq, ne } from "drizzle-orm";
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

export const zoneRegionGroup = new OpenAPIHono<AppBindings>();

async function findRegionById(id: string, options?: { includeDeleted?: boolean }) {
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

async function findZoneById(id: string, options?: { includeDeleted?: boolean }) {
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

registerOpenApiRoute(zoneRegionGroup, listRegions, async (c) => {
  const query = c.req.valid("query");
  const response = await fetchRegionList(query);

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(zoneRegionGroup, getRegion, async (c) => {
  const { id } = c.req.valid("param");
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

  return c.json(createSuccessResponse(regionData), 200);
});

registerOpenApiRoute(zoneRegionGroup, createRegion, async (c) => {
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);

  const existingRegion = await db
    .select({ id: region.id })
    .from(region)
    .where(and(eq(region.name, body.name), eq(region.isDeleted, false)))
    .limit(1)
    .then((rows) => rows[0]);

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
    const duplicateRegion = await db
      .select({ id: region.id })
      .from(region)
      .where(and(eq(region.name, body.name), eq(region.isDeleted, false), ne(region.id, id)))
      .limit(1)
      .then((rows) => rows[0]);

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

  const activeZone = await db
    .select({ id: zone.id })
    .from(zone)
    .where(and(eq(zone.regionId, id), eq(zone.isDeleted, false)))
    .limit(1)
    .then((rows) => rows[0]);

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

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(zoneRegionGroup, getZone, async (c) => {
  const { id } = c.req.valid("param");
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

  return c.json(createSuccessResponse(zoneData), 200);
});

registerOpenApiRoute(zoneRegionGroup, createZone, async (c) => {
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);

  const [regionData, existingZone] = await Promise.all([
    findRegionById(body.regionId),
    db
      .select({ id: zone.id })
      .from(zone)
      .where(
        and(eq(zone.regionId, body.regionId), eq(zone.name, body.name), eq(zone.isDeleted, false))
      )
      .limit(1)
      .then((rows) => rows[0]),
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
    db
      .select({ id: zone.id })
      .from(zone)
      .where(
        and(
          eq(zone.regionId, nextRegionId),
          eq(zone.name, nextName),
          eq(zone.isDeleted, false),
          ne(zone.id, id)
        )
      )
      .limit(1)
      .then((rows) => rows[0]),
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
