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
  proptryxUserCreateSchema,
  proptryxUserListQuerySchema,
  proptryxUserListResponseSchema,
  proptryxUserSchema,
  proptryxUserUpdateSchema,
  proptryxUserWithLocationSchema,
} from "./schema";

const tags = ["Proptryx / Users"];

const proptryxUserRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.user,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const proptryxUserMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "proptryx-user-methods",
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "proptryxUserList",
  tags,
  middleware: [proptryxUserMethodsRateLimit, proptryxUserRbac.custom("getAll")],
  summary: "List Proptryx users",
  request: {
    query: proptryxUserListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(proptryxUserListResponseSchema, "Users fetched successfully"),
  },
});

export const get = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  operationId: "proptryxUserGetById",
  tags,
  middleware: [proptryxUserMethodsRateLimit, proptryxUserRbac.get],
  summary: "Get a Proptryx user by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(proptryxUserWithLocationSchema, "User fetched successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "proptryxUserCreate",
  tags,
  middleware: [proptryxUserMethodsRateLimit, proptryxUserRbac.custom("create")],
  summary: "Create a Proptryx user",
  request: {
    body: createApiJsonBody(proptryxUserCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(proptryxUserSchema, "User created successfully"),
  },
});

export const update = createOpenApiRoute({
  method: "patch",
  path: "/{id}",
  operationId: "proptryxUserUpdateById",
  tags,
  middleware: [proptryxUserMethodsRateLimit, proptryxUserRbac.custom("update")],
  summary: "Update a Proptryx user",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(proptryxUserUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(proptryxUserSchema, "User updated successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const remove = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  operationId: "proptryxUserDeleteById",
  tags,
  middleware: [proptryxUserMethodsRateLimit, proptryxUserRbac.custom("delete")],
  summary: "Delete a Proptryx user",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(proptryxUserSchema, "User deleted successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const resendCredentials = createOpenApiRoute({
  method: "post",
  path: "/{id}/resend-cred",
  operationId: "proptryxUserResendCredentialsById",
  tags,
  middleware: [proptryxUserMethodsRateLimit, proptryxUserRbac.custom("activate")],
  summary: "Resend credentials to a Proptryx user",
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
