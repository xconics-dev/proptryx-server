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
  resourceMetadataListSchema,
  roleCreateSchema,
  roleListQuerySchema,
  roleListResponseSchema,
  rolePermissionCreateSchema,
  rolePermissionSchema,
  rolePermissionUpdateSchema,
  roleSlugAvailabilityQuerySchema,
  roleSlugAvailabilitySchema,
  roleUpdateSchema,
  roleWithPermissionsSchema,
} from "./schema";

const tags = ["Company / Roles & Permissions"];

const roleRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.rbac_role,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const permissionRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.rbac_role_permission,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const rateLimit = createOperationalRateLimit({
  keyPrefix: "kernel-company-roles-permission-methods",
});

const rolePermissionParamsSchema = z.object({
  roleId: z.string().min(1),
  permissionId: z.string().min(1),
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "kernelCompanyRoleList",
  tags,
  middleware: [rateLimit, roleRbac.custom("getAll")],
  summary: "List company roles with permissions from kernel",
  request: { query: roleListQuerySchema },
  responses: {
    200: createApiSuccessResponse(roleListResponseSchema, "Roles fetched successfully"),
  },
});

export const resources = createOpenApiRoute({
  method: "get",
  path: "/resources",
  operationId: "kernelCompanyRolePermissionResourceList",
  tags,
  middleware: [rateLimit, roleRbac.custom("getAll")],
  summary: "List company RBAC resources with table columns and actions from kernel",
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
  operationId: "kernelCompanyRoleGetById",
  tags,
  middleware: [rateLimit, roleRbac.get],
  summary: "Get company role by ID from kernel",
  request: { params: IdStringParamSchema() },
  responses: {
    200: createApiSuccessResponse(roleWithPermissionsSchema, "Role fetched successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const check_slug = createOpenApiRoute({
  method: "get",
  path: "/check-slug",
  operationId: "kernelCompanyRoleCheckSlugAvailability",
  tags,
  middleware: [rateLimit, roleRbac.custom("create")],
  summary: "Check company role slug availability from kernel",
  request: { query: roleSlugAvailabilityQuerySchema },
  responses: {
    200: createApiSuccessResponse(roleSlugAvailabilitySchema, "Role slug checked successfully"),
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "kernelCompanyRoleCreate",
  tags,
  middleware: [rateLimit, roleRbac.custom("create")],
  summary: "Create a company role from kernel",
  request: { body: createApiJsonBody(roleCreateSchema) },
  responses: {
    201: createApiSuccessResponse(roleWithPermissionsSchema, "Role created successfully"),
  },
});

export const update = createOpenApiRoute({
  method: "patch",
  path: "/{id}",
  operationId: "kernelCompanyRoleUpdateById",
  tags,
  middleware: [rateLimit, roleRbac.custom("update")],
  summary: "Update a company role from kernel",
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
  operationId: "kernelCompanyRoleDeleteById",
  tags,
  middleware: [rateLimit, roleRbac.custom("delete")],
  summary: "Delete a company role from kernel",
  request: { params: IdStringParamSchema() },
  responses: {
    200: createApiSuccessResponse(roleWithPermissionsSchema, "Role deleted successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const create_permission = createOpenApiRoute({
  method: "post",
  path: "/{id}/permissions",
  operationId: "kernelCompanyRolePermissionCreate",
  tags,
  middleware: [rateLimit, permissionRbac.custom("create")],
  summary: "Create a permission for a company role from kernel",
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
  operationId: "kernelCompanyRolePermissionUpdateById",
  tags,
  middleware: [rateLimit, permissionRbac.custom("update")],
  summary: "Update a company role permission from kernel",
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
  operationId: "kernelCompanyRolePermissionDeleteById",
  tags,
  middleware: [rateLimit, permissionRbac.custom("delete")],
  summary: "Delete a company role permission from kernel",
  request: { params: rolePermissionParamsSchema },
  responses: {
    200: createApiSuccessResponse(rolePermissionSchema, "Permission deleted successfully"),
    404: ApiNotFoundOpenApi,
  },
});
