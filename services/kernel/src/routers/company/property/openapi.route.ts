import { DATABASE_RESOURCES } from "@proptryx/database";
import {
  ApiBadRequestOpenApi,
  ApiNotFoundOpenApi,
  DEFAULT_FAST_RBAC_AUTH_OPTIONS,
  IdStringParamSchema,
  createApiJsonBody,
  createApiSuccessResponse,
  createOpenApiRoute,
  createOperationalRateLimit,
  createResourceRbacGuards,
  getBetterAuthContext,
} from "@proptryx/utils";
import type { MiddlewareHandler } from "hono";
import {
  propertyCreateSchema,
  propertyDetailSchema,
  propertyGetQuerySchema,
  propertyListQuerySchema,
  propertyListResponseSchema,
  propertyPermanentDeleteResultSchema,
  propertyUpdateSchema,
} from "./schema";

const tags = ["Properties"];

const propertyRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.property,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const allowProptryxBrokerOr =
  (middleware: MiddlewareHandler): MiddlewareHandler =>
  async (c, next) => {
    const authContext = getBetterAuthContext(c);
    const panel = authContext.authorization.panel ?? authContext.user?.panel ?? null;
    const role = authContext.authorization.role ?? authContext.user?.role ?? null;

    if (panel === "proptryx" && role?.trim().toLowerCase() === "broker") {
      await next();
      return;
    }

    return middleware(c, next);
  };

const propertyMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "kernel-company-property-methods",
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "kernelCompanyPropertyList",
  tags,
  middleware: [propertyMethodsRateLimit, allowProptryxBrokerOr(propertyRbac.custom("getAll"))],
  summary: "List properties across organizations",
  request: {
    query: propertyListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(propertyListResponseSchema, "Properties fetched successfully"),
  },
});

export const get = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  operationId: "kernelCompanyPropertyGetById",
  tags,
  middleware: [propertyMethodsRateLimit, allowProptryxBrokerOr(propertyRbac.get)],
  summary: "Get property by ID",
  request: {
    params: IdStringParamSchema(),
    query: propertyGetQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(propertyDetailSchema, "Property fetched successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "kernelCompanyPropertyCreate",
  tags,
  middleware: [propertyMethodsRateLimit, allowProptryxBrokerOr(propertyRbac.custom("create"))],
  summary: "Create property for any organization",
  request: {
    body: createApiJsonBody(propertyCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(propertyDetailSchema, "Property created successfully"),
    400: ApiBadRequestOpenApi,
  },
});

export const update = createOpenApiRoute({
  method: "patch",
  path: "/{id}",
  operationId: "kernelCompanyPropertyUpdateById",
  tags,
  middleware: [propertyMethodsRateLimit, allowProptryxBrokerOr(propertyRbac.custom("update"))],
  summary: "Update property by ID",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(propertyUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(propertyDetailSchema, "Property updated successfully"),
    400: ApiBadRequestOpenApi,
    404: ApiNotFoundOpenApi,
  },
});

export const remove = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  operationId: "kernelCompanyPropertyDeleteById",
  tags,
  middleware: [propertyMethodsRateLimit, allowProptryxBrokerOr(propertyRbac.custom("delete"))],
  summary: "Soft delete property by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(propertyDetailSchema, "Property deleted successfully"),
    400: ApiBadRequestOpenApi,
    404: ApiNotFoundOpenApi,
  },
});

export const restore = createOpenApiRoute({
  method: "post",
  path: "/{id}/restore",
  operationId: "kernelCompanyPropertyRestoreById",
  tags,
  middleware: [propertyMethodsRateLimit, allowProptryxBrokerOr(propertyRbac.custom("update"))],
  summary: "Restore property by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(propertyDetailSchema, "Property restored successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const removePermanently = createOpenApiRoute({
  method: "delete",
  path: "/{id}/permanent",
  operationId: "kernelCompanyPropertyPermanentDeleteById",
  tags,
  middleware: [propertyMethodsRateLimit, allowProptryxBrokerOr(propertyRbac.custom("delete"))],
  summary: "Permanently delete property by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      propertyPermanentDeleteResultSchema,
      "Property permanently deleted successfully"
    ),
    404: ApiNotFoundOpenApi,
  },
});
