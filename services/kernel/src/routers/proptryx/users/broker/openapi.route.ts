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
  proptryxBrokerUserCreateSchema,
  proptryxBrokerUserListQuerySchema,
  proptryxBrokerUserListResponseSchema,
  proptryxBrokerUserSchema,
  proptryxBrokerUserUpdateSchema,
  proptryxBrokerUserWithLocationSchema,
} from "./schema";

const tags = ["Proptryx / Broker Users"];

const proptryxBrokerUserRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.user,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const proptryxBrokerUserMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "proptryx-broker-user-methods",
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "proptryxBrokerUserList",
  tags,
  middleware: [proptryxBrokerUserMethodsRateLimit, proptryxBrokerUserRbac.custom("getAll")],
  summary: "List Proptryx broker users",
  request: {
    query: proptryxBrokerUserListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(
      proptryxBrokerUserListResponseSchema,
      "Broker users fetched successfully"
    ),
  },
});

export const get = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  operationId: "proptryxBrokerUserGetById",
  tags,
  middleware: [proptryxBrokerUserMethodsRateLimit, proptryxBrokerUserRbac.get],
  summary: "Get a Proptryx broker user by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      proptryxBrokerUserWithLocationSchema,
      "Broker user fetched successfully"
    ),
    404: ApiNotFoundOpenApi,
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "proptryxBrokerUserCreate",
  tags,
  middleware: [proptryxBrokerUserMethodsRateLimit, proptryxBrokerUserRbac.custom("create")],
  summary: "Create a Proptryx broker user",
  request: {
    body: createApiJsonBody(proptryxBrokerUserCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(proptryxBrokerUserSchema, "Broker user created successfully"),
  },
});

export const update = createOpenApiRoute({
  method: "patch",
  path: "/{id}",
  operationId: "proptryxBrokerUserUpdateById",
  tags,
  middleware: [proptryxBrokerUserMethodsRateLimit, proptryxBrokerUserRbac.custom("update")],
  summary: "Update a Proptryx broker user",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(proptryxBrokerUserUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(proptryxBrokerUserSchema, "Broker user updated successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const remove = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  operationId: "proptryxBrokerUserDeleteById",
  tags,
  middleware: [proptryxBrokerUserMethodsRateLimit, proptryxBrokerUserRbac.custom("delete")],
  summary: "Delete a Proptryx broker user",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(proptryxBrokerUserSchema, "Broker user deleted successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const resend_cred = createOpenApiRoute({
  method: "post",
  path: "/{id}/resend-cred",
  operationId: "proptryxBrokerUserResendCredentialsById",
  tags,
  middleware: [proptryxBrokerUserMethodsRateLimit, proptryxBrokerUserRbac.custom("resend_cred")],
  summary: "Resend credentials to a Proptryx broker user",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: {
      description: "Credentials resent successfully",
    },
    404: ApiNotFoundOpenApi,
  },
});
