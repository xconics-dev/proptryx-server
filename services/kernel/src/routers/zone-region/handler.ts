import type { AppBindings } from "@/types/app";
import { emitNotificationResourceEvent } from "@/lib/notification-events";
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

function getActorVariables(
  user?: { id?: string; name?: string | null; email?: string | null } | null
) {
  return {
    actorUserId: user?.id ?? "",
    actorName: user?.name ?? user?.email ?? "Current User",
  };
}

function getRegionVariables(
  regionData: typeof region.$inferSelect,
  user?: { id?: string; name?: string | null; email?: string | null } | null,
  extra: Record<string, unknown> = {}
) {
  return {
    id: regionData.id,
    regionId: regionData.id,
    name: regionData.name,
    regionName: regionData.name,
    createdAt: regionData.createdAt.toISOString(),
    updatedAt: regionData.updatedAt.toISOString(),
    ...getActorVariables(user),
    ...extra,
  };
}

function getZoneVariables(
  zoneData: typeof zone.$inferSelect,
  user?: { id?: string; name?: string | null; email?: string | null } | null,
  extra: Record<string, unknown> = {}
) {
  return {
    id: zoneData.id,
    zoneId: zoneData.id,
    name: zoneData.name,
    zoneName: zoneData.name,
    regionId: zoneData.regionId,
    createdAt: zoneData.createdAt.toISOString(),
    updatedAt: zoneData.updatedAt.toISOString(),
    ...getActorVariables(user),
    ...extra,
  };
}

function getRegionEventDefaults(regionData: typeof region.$inferSelect, operation: string) {
  return {
    relatedEntityType: "region",
    relatedEntityId: regionData.id,
    defaultActionUrl: `/utility/location/region/${regionData.id}`,
    defaultTag: `region:${regionData.id}:${operation}`,
  };
}

function getZoneEventDefaults(zoneData: typeof zone.$inferSelect, operation: string) {
  return {
    relatedEntityType: "zone",
    relatedEntityId: zoneData.id,
    defaultActionUrl: `/utility/location/zone/${zoneData.id}`,
    defaultTag: `zone:${zoneData.id}:${operation}`,
  };
}

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

  const regionId = generateRandomId();
  await emitNotificationResourceEvent({
    resource: "region",
    operation: "create",
    phase: "before",
    relatedEntityType: "region",
    relatedEntityId: regionId,
    variables: {
      id: regionId,
      regionId,
      name: body.name,
      regionName: body.name,
      ...getActorVariables(user),
    },
    data: {
      type: "region-create-before",
      entityType: "region",
      entityId: regionId,
      regionName: body.name,
    },
    defaultTitle: "Region creation started",
    defaultBody: `${body.name} region is being created.`,
    defaultActionUrl: `/utility/location/region/${regionId}`,
    defaultTag: `region:${regionId}:create:before`,
    logContext: "kernel.zone-region.region.create.before",
  });

  const [createdRegion] = await db
    .insert(region)
    .values({
      id: regionId,
      createdByUser: user?.id ?? null,
      ...body,
    })
    .returning();

  await emitNotificationResourceEvent({
    resource: "region",
    operation: "create",
    phase: "after",
    ...getRegionEventDefaults(createdRegion, "create"),
    variables: getRegionVariables(createdRegion, user),
    data: {
      type: "region-created",
      entityType: "region",
      entityId: createdRegion.id,
      regionName: createdRegion.name,
    },
    defaultTitle: "Region created",
    defaultBody: `${createdRegion.name} region was created.`,
    logContext: "kernel.zone-region.region.create.after",
  });

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

  await emitNotificationResourceEvent({
    resource: "region",
    operation: "update",
    phase: "before",
    ...getRegionEventDefaults(existingRegion, "update"),
    variables: getRegionVariables(existingRegion, user, {
      previousName: existingRegion.name,
      nextName: body.name ?? existingRegion.name,
    }),
    data: {
      type: "region-update-before",
      entityType: "region",
      entityId: existingRegion.id,
      regionName: existingRegion.name,
    },
    defaultTitle: "Region update started",
    defaultBody: `${existingRegion.name} region is being updated.`,
    logContext: "kernel.zone-region.region.update.before",
  });

  const [updatedRegion] = await db
    .update(region)
    .set({ ...body, updatedByUser: user?.id ?? null })
    .where(eq(region.id, id))
    .returning();

  await emitNotificationResourceEvent({
    resource: "region",
    operation: "update",
    phase: "after",
    ...getRegionEventDefaults(updatedRegion, "update"),
    variables: getRegionVariables(updatedRegion, user, {
      previousName: existingRegion.name,
    }),
    data: {
      type: "region-updated",
      entityType: "region",
      entityId: updatedRegion.id,
      regionName: updatedRegion.name,
    },
    defaultTitle: "Region updated",
    defaultBody: `${updatedRegion.name} region was updated.`,
    logContext: "kernel.zone-region.region.update.after",
  });

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

  await emitNotificationResourceEvent({
    resource: "region",
    operation: "delete",
    phase: "before",
    ...getRegionEventDefaults(existingRegion, "delete"),
    variables: getRegionVariables(existingRegion, user),
    data: {
      type: "region-delete-before",
      entityType: "region",
      entityId: existingRegion.id,
      regionName: existingRegion.name,
    },
    defaultTitle: "Region deletion started",
    defaultBody: `${existingRegion.name} region is being deleted.`,
    logContext: "kernel.zone-region.region.delete.before",
  });

  await db
    .update(region)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: user?.id ?? null,
    })
    .where(eq(region.id, id));

  const deletedRegion = await findRegionById(id, { includeDeleted: true });
  const regionForEvent = deletedRegion ?? existingRegion;

  await emitNotificationResourceEvent({
    resource: "region",
    operation: "delete",
    phase: "after",
    ...getRegionEventDefaults(regionForEvent, "delete"),
    variables: getRegionVariables(regionForEvent, user),
    data: {
      type: "region-deleted",
      entityType: "region",
      entityId: regionForEvent.id,
      regionName: regionForEvent.name,
    },
    defaultTitle: "Region deleted",
    defaultBody: `${regionForEvent.name} region was deleted.`,
    logContext: "kernel.zone-region.region.delete.after",
  });

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

  const zoneId = generateRandomId();
  await emitNotificationResourceEvent({
    resource: "zone",
    operation: "create",
    phase: "before",
    relatedEntityType: "zone",
    relatedEntityId: zoneId,
    variables: {
      id: zoneId,
      zoneId,
      name: body.name,
      zoneName: body.name,
      regionId: body.regionId,
      regionName: regionData.name,
      ...getActorVariables(user),
    },
    data: {
      type: "zone-create-before",
      entityType: "zone",
      entityId: zoneId,
      zoneName: body.name,
      regionId: body.regionId,
      regionName: regionData.name,
    },
    defaultTitle: "Zone creation started",
    defaultBody: `${body.name} zone is being created.`,
    defaultActionUrl: `/utility/location/zone/${zoneId}`,
    defaultTag: `zone:${zoneId}:create:before`,
    logContext: "kernel.zone-region.zone.create.before",
  });

  const [createdZone] = await db
    .insert(zone)
    .values({
      id: zoneId,
      ...body,
      createdByUser: user?.id ?? null,
    })
    .returning();

  await emitNotificationResourceEvent({
    resource: "zone",
    operation: "create",
    phase: "after",
    ...getZoneEventDefaults(createdZone, "create"),
    variables: getZoneVariables(createdZone, user, {
      regionName: regionData.name,
    }),
    data: {
      type: "zone-created",
      entityType: "zone",
      entityId: createdZone.id,
      zoneName: createdZone.name,
      regionId: createdZone.regionId,
      regionName: regionData.name,
    },
    defaultTitle: "Zone created",
    defaultBody: `${createdZone.name} zone was created.`,
    logContext: "kernel.zone-region.zone.create.after",
  });

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

  await emitNotificationResourceEvent({
    resource: "zone",
    operation: "update",
    phase: "before",
    ...getZoneEventDefaults(existingZone, "update"),
    variables: getZoneVariables(existingZone, user, {
      previousName: existingZone.name,
      nextName,
      previousRegionId: existingZone.regionId,
      nextRegionId,
      regionName: regionData.name,
    }),
    data: {
      type: "zone-update-before",
      entityType: "zone",
      entityId: existingZone.id,
      zoneName: existingZone.name,
      regionId: existingZone.regionId,
    },
    defaultTitle: "Zone update started",
    defaultBody: `${existingZone.name} zone is being updated.`,
    logContext: "kernel.zone-region.zone.update.before",
  });

  const [updatedZone] = await db
    .update(zone)
    .set({ ...body, updatedByUser: user?.id ?? null })
    .where(eq(zone.id, id))
    .returning();

  await emitNotificationResourceEvent({
    resource: "zone",
    operation: "update",
    phase: "after",
    ...getZoneEventDefaults(updatedZone, "update"),
    variables: getZoneVariables(updatedZone, user, {
      previousName: existingZone.name,
      previousRegionId: existingZone.regionId,
      regionName: regionData.name,
    }),
    data: {
      type: "zone-updated",
      entityType: "zone",
      entityId: updatedZone.id,
      zoneName: updatedZone.name,
      regionId: updatedZone.regionId,
      regionName: regionData.name,
    },
    defaultTitle: "Zone updated",
    defaultBody: `${updatedZone.name} zone was updated.`,
    logContext: "kernel.zone-region.zone.update.after",
  });

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

  await emitNotificationResourceEvent({
    resource: "zone",
    operation: "delete",
    phase: "before",
    ...getZoneEventDefaults(existingZone, "delete"),
    variables: getZoneVariables(existingZone, user),
    data: {
      type: "zone-delete-before",
      entityType: "zone",
      entityId: existingZone.id,
      zoneName: existingZone.name,
      regionId: existingZone.regionId,
    },
    defaultTitle: "Zone deletion started",
    defaultBody: `${existingZone.name} zone is being deleted.`,
    logContext: "kernel.zone-region.zone.delete.before",
  });

  await db
    .update(zone)
    .set({
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: user?.id ?? null,
    })
    .where(eq(zone.id, id));

  const deletedZone = await findZoneById(id, { includeDeleted: true });
  const zoneForEvent = deletedZone ?? existingZone;

  await emitNotificationResourceEvent({
    resource: "zone",
    operation: "delete",
    phase: "after",
    ...getZoneEventDefaults(zoneForEvent, "delete"),
    variables: getZoneVariables(zoneForEvent, user),
    data: {
      type: "zone-deleted",
      entityType: "zone",
      entityId: zoneForEvent.id,
      zoneName: zoneForEvent.name,
      regionId: zoneForEvent.regionId,
    },
    defaultTitle: "Zone deleted",
    defaultBody: `${zoneForEvent.name} zone was deleted.`,
    logContext: "kernel.zone-region.zone.delete.after",
  });

  return c.json(createSuccessResponse(deletedZone ?? existingZone), 200);
});
