import { DATABASE_RESOURCES } from "@proptryx/database";
import {
  createApiJsonBody,
  ApiNotFoundOpenApi,
  createApiSuccessResponse,
  createOpenApiRoute,
  createOperationalRateLimit,
  createResourceRbacGuards,
  DEFAULT_FAST_RBAC_AUTH_OPTIONS,
  IdStringParamSchema,
} from "@proptryx/utils";
import {
  brokerRequestBaseSchema,
  brokerRequestCreateSchema,
  brokerRequestListQuerySchema,
  brokerRequestListResponseSchema,
  brokerRequestPermanentDeleteResultSchema,
} from "./schema";

const tags = ["Company / Requests / Broker"];

const brokerRequestRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.broker_request,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const brokerMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "company-request-broker-methods",
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "brokerRequestList",
  tags,
  middleware: [brokerMethodsRateLimit, brokerRequestRbac.custom("getAll")],
  summary: "List broker requests",
  request: {
    query: brokerRequestListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(
      brokerRequestListResponseSchema,
      "Broker requests fetched successfully"
    ),
  },
});

export const get = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  operationId: "brokerRequestGetById",
  tags,
  middleware: [brokerMethodsRateLimit, brokerRequestRbac.get],
  summary: "Get a broker request by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    404: ApiNotFoundOpenApi,
    200: createApiSuccessResponse(brokerRequestBaseSchema, "Broker request fetched successfully"),
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "brokerRequestCreate",
  tags,
  middleware: [brokerMethodsRateLimit],
  summary: "Create a new broker request",
  request: {
    body: createApiJsonBody(brokerRequestCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(brokerRequestBaseSchema, "Broker request created successfully"),
  },
});

export const remove = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  operationId: "brokerRequestDeleteById",
  tags,
  middleware: [brokerMethodsRateLimit, brokerRequestRbac.delete],
  summary: "Delete a broker request by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    204: {
      description: "Broker request deleted successfully",
    },
    404: ApiNotFoundOpenApi,
  },
});

export const restore = createOpenApiRoute({
  method: "post",
  path: "/{id}/restore",
  operationId: "brokerRequestRestoreById",
  tags,
  middleware: [brokerMethodsRateLimit, brokerRequestRbac.custom("update")],
  summary: "Restore a deleted broker request by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    404: ApiNotFoundOpenApi,
    200: createApiSuccessResponse(brokerRequestBaseSchema, "Broker request restored successfully"),
  },
});

export const removePermanently = createOpenApiRoute({
  method: "delete",
  path: "/{id}/permanent",
  operationId: "brokerRequestPermanentDeleteById",
  tags,
  middleware: [brokerMethodsRateLimit, brokerRequestRbac.delete],
  summary: "Permanently delete a broker request by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    404: ApiNotFoundOpenApi,
    200: createApiSuccessResponse(
      brokerRequestPermanentDeleteResultSchema,
      "Broker request permanently deleted successfully"
    ),
  },
});
