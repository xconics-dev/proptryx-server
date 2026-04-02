import { DATABASE_RESOURCES } from "@proptryx/database";
import {
  ApiNotFoundOpenApi,
  createApiJsonBody,
  createApiSuccessResponse,
  createOpenApiRoute,
  createOperationalRateLimit,
  createResourceRbacGuards,
  DEFAULT_FAST_RBAC_AUTH_OPTIONS,
  IdStringParamSchema,
} from "@proptryx/utils";
import {
  regionCreateSchema,
  regionListQuerySchema,
  regionListResponseSchema,
  regionSchema,
  regionUpdateSchema,
  zoneCreateSchema,
  zoneListQuerySchema,
  zoneListResponseSchema,
  zoneSchema,
  zoneUpdateSchema,
} from "./schema";

const regionTags = ["Regions"];
const zoneTags = ["Zones"];

const regionRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.region,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const zoneRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.zone,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const zoneRegionMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "zone-region-methods",
});

export const listRegions = createOpenApiRoute({
  method: "get",
  path: "/regions/list",
  tags: regionTags,
  middleware: [zoneRegionMethodsRateLimit, regionRbac.custom("getAll")],
  summary: "List regions",
  request: {
    query: regionListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(regionListResponseSchema, "Regions fetched successfully"),
  },
});

export const getRegion = createOpenApiRoute({
  method: "get",
  path: "/regions/{id}",
  tags: regionTags,
  middleware: [zoneRegionMethodsRateLimit, regionRbac.get],
  summary: "Get a region by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(regionSchema, "Region fetched successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const createRegion = createOpenApiRoute({
  method: "post",
  path: "/regions",
  tags: regionTags,
  middleware: [zoneRegionMethodsRateLimit, regionRbac.custom("create")],
  summary: "Create a region",
  request: {
    body: createApiJsonBody(regionCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(regionSchema, "Region created successfully"),
  },
});

export const updateRegion = createOpenApiRoute({
  method: "patch",
  path: "/regions/{id}",
  tags: regionTags,
  middleware: [zoneRegionMethodsRateLimit, regionRbac.custom("update")],
  summary: "Update a region by ID",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(regionUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(regionSchema, "Region updated successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const removeRegion = createOpenApiRoute({
  method: "delete",
  path: "/regions/{id}",
  tags: regionTags,
  middleware: [zoneRegionMethodsRateLimit, regionRbac.custom("delete")],
  summary: "Delete a region by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(regionSchema, "Region deleted successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const listZones = createOpenApiRoute({
  method: "get",
  path: "/zones/list",
  tags: zoneTags,
  middleware: [zoneRegionMethodsRateLimit, zoneRbac.custom("getAll")],
  summary: "List zones",
  request: {
    query: zoneListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(zoneListResponseSchema, "Zones fetched successfully"),
  },
});

export const getZone = createOpenApiRoute({
  method: "get",
  path: "/zones/{id}",
  tags: zoneTags,
  middleware: [zoneRegionMethodsRateLimit, zoneRbac.get],
  summary: "Get a zone by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(zoneSchema, "Zone fetched successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const createZone = createOpenApiRoute({
  method: "post",
  path: "/zones",
  tags: zoneTags,
  middleware: [zoneRegionMethodsRateLimit, zoneRbac.custom("create")],
  summary: "Create a zone",
  request: {
    body: createApiJsonBody(zoneCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(zoneSchema, "Zone created successfully"),
  },
});

export const updateZone = createOpenApiRoute({
  method: "patch",
  path: "/zones/{id}",
  tags: zoneTags,
  middleware: [zoneRegionMethodsRateLimit, zoneRbac.custom("update")],
  summary: "Update a zone by ID",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(zoneUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(zoneSchema, "Zone updated successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const removeZone = createOpenApiRoute({
  method: "delete",
  path: "/zones/{id}",
  tags: zoneTags,
  middleware: [zoneRegionMethodsRateLimit, zoneRbac.custom("delete")],
  summary: "Delete a zone by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(zoneSchema, "Zone deleted successfully"),
    404: ApiNotFoundOpenApi,
  },
});
