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
  keyPrefix: "kernel-company-property-methods",
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "kernelCompanyPropertyList",
  tags,
  middleware: [propertyMethodsRateLimit, propertyRbac.custom("getAll")],
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
  middleware: [propertyMethodsRateLimit, propertyRbac.get],
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
  middleware: [propertyMethodsRateLimit, propertyRbac.custom("create")],
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
  middleware: [propertyMethodsRateLimit, propertyRbac.custom("update")],
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
  middleware: [propertyMethodsRateLimit, propertyRbac.custom("delete")],
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
