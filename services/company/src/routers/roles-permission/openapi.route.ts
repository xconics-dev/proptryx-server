import { DATABASE_RESOURCES } from "@proptryx/database";
import {
  ApiNotFoundOpenApi,
  createApiJsonBody,
  createApiSuccessResponse,
  createOpenApiRoute,
  createOperationalRateLimit,
  createResourceRbacGuards,
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
  resourceMetadataListSchema,
  roleUpdateSchema,
  roleWithPermissionsSchema,
} from "./schema";

const tags = ["Roles & Permissions"];

const companyAuth = {
  enableRedisCache: true,
  entities: {
    data: false,
    user: true,
    session: true,
    organization: true,
    hasOrganization: true,
  },
  cacheTtlMs: 5_000,
  requiredEntities: ["organization" as const],
};

const roleRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.rbac_role,
  auth: companyAuth,
});

const permissionRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.rbac_role_permission,
  auth: companyAuth,
});

const rateLimit = createOperationalRateLimit({
  keyPrefix: "company-roles-permission-methods",
});

const rolePermissionParamsSchema = z.object({
  roleId: z.string().min(1),
  permissionId: z.string().min(1),
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "companyRoleList",
  tags,
  middleware: [rateLimit, roleRbac.custom("getAll")],
  summary: "List company roles with permissions",
  request: { query: roleListQuerySchema },
  responses: {
    200: createApiSuccessResponse(roleListResponseSchema, "Roles fetched successfully"),
  },
});

export const resources = createOpenApiRoute({
  method: "get",
  path: "/resources",
  operationId: "companyRolePermissionResourceList",
  tags,
  middleware: [rateLimit, roleRbac.custom("getAll")],
  summary: "List company RBAC resources with table columns and actions",
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
  operationId: "companyRoleGetById",
  tags,
  middleware: [rateLimit, roleRbac.get],
  summary: "Get company role by ID",
  request: { params: IdStringParamSchema() },
  responses: {
    200: createApiSuccessResponse(roleWithPermissionsSchema, "Role fetched successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "companyRoleCreate",
  tags,
  middleware: [rateLimit, roleRbac.custom("create")],
  summary: "Create a company role",
  request: { body: createApiJsonBody(roleCreateSchema) },
  responses: {
    201: createApiSuccessResponse(roleWithPermissionsSchema, "Role created successfully"),
  },
});

export const update = createOpenApiRoute({
  method: "patch",
  path: "/{id}",
  operationId: "companyRoleUpdateById",
  tags,
  middleware: [rateLimit, roleRbac.custom("update")],
  summary: "Update a company role",
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
  operationId: "companyRoleDeleteById",
  tags,
  middleware: [rateLimit, roleRbac.custom("delete")],
  summary: "Delete a company role",
  request: { params: IdStringParamSchema() },
  responses: {
    200: createApiSuccessResponse(roleWithPermissionsSchema, "Role deleted successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const create_permission = createOpenApiRoute({
  method: "post",
  path: "/{id}/permissions",
  operationId: "companyRolePermissionCreate",
  tags,
  middleware: [rateLimit, permissionRbac.custom("create")],
  summary: "Create a permission for a company role",
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
  operationId: "companyRolePermissionUpdateById",
  tags,
  middleware: [rateLimit, permissionRbac.custom("update")],
  summary: "Update a company role permission",
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
  operationId: "companyRolePermissionDeleteById",
  tags,
  middleware: [rateLimit, permissionRbac.custom("delete")],
  summary: "Delete a company role permission",
  request: { params: rolePermissionParamsSchema },
  responses: {
    200: createApiSuccessResponse(rolePermissionSchema, "Permission deleted successfully"),
    404: ApiNotFoundOpenApi,
  },
});
