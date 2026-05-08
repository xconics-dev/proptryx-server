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
} from "@proptryx/utils";
import {
  propertyCreateSchema,
  propertyDetailSchema,
  propertyGetQuerySchema,
  propertyListQuerySchema,
  propertyListResponseSchema,
  propertyUpdateSchema,
} from "./schema";

const tags = ["Properties"];

const propertyRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.property,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const propertyMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "property-methods",
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "companyPropertyList",
  tags,
  middleware: [propertyMethodsRateLimit, propertyRbac.custom("getAll")],
  summary: "List organization properties",
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
  operationId: "companyPropertyGetById",
  tags,
  middleware: [propertyMethodsRateLimit, propertyRbac.get],
  summary: "Get organization property by ID",
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
  operationId: "companyPropertyCreate",
  tags,
  middleware: [propertyMethodsRateLimit, propertyRbac.custom("create")],
  summary: "Create property for current organization",
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
  operationId: "companyPropertyUpdateById",
  tags,
  middleware: [propertyMethodsRateLimit, propertyRbac.custom("update")],
  summary: "Update organization property",
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
  operationId: "companyPropertyDeleteById",
  tags,
  middleware: [propertyMethodsRateLimit, propertyRbac.custom("delete")],
  summary: "Soft delete organization property",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(propertyDetailSchema, "Property deleted successfully"),
    400: ApiBadRequestOpenApi,
    404: ApiNotFoundOpenApi,
  },
});
