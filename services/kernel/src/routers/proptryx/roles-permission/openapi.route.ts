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
import z from "zod";
import {
  roleCreateSchema,
  roleListQuerySchema,
  roleListResponseSchema,
  rolePermissionCreateSchema,
  rolePermissionSchema,
  rolePermissionUpdateSchema,
  roleSlugAvailabilityQuerySchema,
  roleSlugAvailabilitySchema,
  resourceMetadataListSchema,
  roleUpdateSchema,
  roleWithPermissionsSchema,
} from "./schema";

const tags = ["Proptryx / Roles & Permissions"];

const roleRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.rbac_role,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const permissionRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.rbac_role_permission,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const rateLimit = createOperationalRateLimit({
  keyPrefix: "proptryx-roles-permission-methods",
});

const rolePermissionParamsSchema = z.object({
  roleId: z.string().min(1),
  permissionId: z.string().min(1),
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "proptryxRoleList",
  tags,
  middleware: [rateLimit, roleRbac.custom("getAll")],
  summary: "List Proptryx roles with permissions",
  request: { query: roleListQuerySchema },
  responses: {
    200: createApiSuccessResponse(roleListResponseSchema, "Roles fetched successfully"),
  },
});

export const resources = createOpenApiRoute({
  method: "get",
  path: "/resources",
  operationId: "proptryxRolePermissionResourceList",
  tags,
  middleware: [rateLimit, roleRbac.custom("getAll")],
  summary: "List Proptryx RBAC resources with table columns and actions",
  responses: {
    200: createApiSuccessResponse(
      resourceMetadataListSchema,
      "RBAC resources fetched successfully"
    ),
  },
});

export const get = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  operationId: "proptryxRoleGetById",
  tags,
  middleware: [rateLimit, roleRbac.get],
  summary: "Get Proptryx role by ID",
  request: { params: IdStringParamSchema() },
  responses: {
    200: createApiSuccessResponse(roleWithPermissionsSchema, "Role fetched successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const check_slug = createOpenApiRoute({
  method: "get",
  path: "/check-slug",
  operationId: "proptryxRoleCheckSlugAvailability",
  tags,
  middleware: [rateLimit, roleRbac.custom("create")],
  summary: "Check Proptryx role slug availability",
  request: { query: roleSlugAvailabilityQuerySchema },
  responses: {
    200: createApiSuccessResponse(roleSlugAvailabilitySchema, "Role slug checked successfully"),
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "proptryxRoleCreate",
  tags,
  middleware: [rateLimit, roleRbac.custom("create")],
  summary: "Create a Proptryx role",
  request: { body: createApiJsonBody(roleCreateSchema) },
  responses: {
    201: createApiSuccessResponse(roleWithPermissionsSchema, "Role created successfully"),
  },
});

export const update = createOpenApiRoute({
  method: "patch",
  path: "/{id}",
  operationId: "proptryxRoleUpdateById",
  tags,
  middleware: [rateLimit, roleRbac.custom("update")],
  summary: "Update a Proptryx role",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(roleUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(roleWithPermissionsSchema, "Role updated successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const remove = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  operationId: "proptryxRoleDeleteById",
  tags,
  middleware: [rateLimit, roleRbac.custom("delete")],
  summary: "Delete a Proptryx role",
  request: { params: IdStringParamSchema() },
  responses: {
    200: createApiSuccessResponse(roleWithPermissionsSchema, "Role deleted successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const create_permission = createOpenApiRoute({
  method: "post",
  path: "/{id}/permissions",
  operationId: "proptryxRolePermissionCreate",
  tags,
  middleware: [rateLimit, permissionRbac.custom("create")],
  summary: "Create a permission for a Proptryx role",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(rolePermissionCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(rolePermissionSchema, "Permission created successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const update_permission = createOpenApiRoute({
  method: "patch",
  path: "/{roleId}/permissions/{permissionId}",
  operationId: "proptryxRolePermissionUpdateById",
  tags,
  middleware: [rateLimit, permissionRbac.custom("update")],
  summary: "Update a Proptryx role permission",
  request: {
    params: rolePermissionParamsSchema,
    body: createApiJsonBody(rolePermissionUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(rolePermissionSchema, "Permission updated successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const remove_permission = createOpenApiRoute({
  method: "delete",
  path: "/{roleId}/permissions/{permissionId}",
  operationId: "proptryxRolePermissionDeleteById",
  tags,
  middleware: [rateLimit, permissionRbac.custom("delete")],
  summary: "Delete a Proptryx role permission",
  request: { params: rolePermissionParamsSchema },
  responses: {
    200: createApiSuccessResponse(rolePermissionSchema, "Permission deleted successfully"),
    404: ApiNotFoundOpenApi,
  },
});
