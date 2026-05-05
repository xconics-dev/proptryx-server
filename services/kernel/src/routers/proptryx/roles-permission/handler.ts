import type { AppBindings } from "@/types/app";
import { OpenAPIHono } from "@hono/zod-openapi";
import { db, getRbacResourceMetadata, rbacRole, rbacRolePermission } from "@proptryx/database";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  isManagedRolePermissionResource,
  mergeManagedRolePermissions,
  normalizeManagedRolePermission,
  registerOpenApiRoute,
} from "@proptryx/utils";
import { eq } from "drizzle-orm";
import {
  create,
  create_permission,
  get,
  list,
  remove,
  remove_permission,
  resources,
  update,
  update_permission,
} from "./openapi.route";
import {
  attachPermissions,
  createPermissionValues,
  createRoleSlug,
  fetchRoleList,
  findPermissionById,
  findRoleDetailsById,
  findRoleSlugConflict,
  normalizePermissionValues,
} from "./utils";

export const proptryxRolesPermissionGroup = new OpenAPIHono<AppBindings>();

registerOpenApiRoute(proptryxRolesPermissionGroup, list, async (c) => {
  const query = c.req.valid("query");
  const response = await fetchRoleList(query);

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(proptryxRolesPermissionGroup, resources, async (c) => {
  return c.json(createSuccessResponse(getRbacResourceMetadata("proptryx")), 200);
});

registerOpenApiRoute(proptryxRolesPermissionGroup, get, async (c) => {
  const { id } = c.req.valid("param");
  const role = await findRoleDetailsById(id);

  if (!role) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Role not found" }), 404);
  }

  return c.json(createSuccessResponse(role), 200);
});

registerOpenApiRoute(proptryxRolesPermissionGroup, create, async (c) => {
  const body = c.req.valid("json");
  const slug = body.slug ?? createRoleSlug(body.name);
  const slugConflict = await findRoleSlugConflict(slug);

  if (slugConflict) {
    return c.json(
      createErrorResponse({
        error: "Conflict",
        message: "Role with this slug already exists",
      }),
      409
    );
  }

  const role = await db.transaction(async (tx) => {
    const [insertedRole] = await tx
      .insert(rbacRole)
      .values({
        id: generateRandomId(),
        name: body.name,
        slug,
        description: body.description,
        panel: "proptryx",
        organizationId: null,
        isActive: body.isActive ?? true,
        isSystem: false,
      })
      .returning();

    const permissions = mergeManagedRolePermissions(body.permissions, "proptryx");

    if (permissions.length > 0) {
      await tx
        .insert(rbacRolePermission)
        .values(
          permissions.map((permission) => createPermissionValues(insertedRole.id, permission))
        );
    }

    return insertedRole;
  });

  const [roleWithPermissions] = await attachPermissions([role]);

  return c.json(createSuccessResponse(roleWithPermissions), 201);
});

registerOpenApiRoute(proptryxRolesPermissionGroup, update, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const existingRole = await findRoleDetailsById(id);

  if (!existingRole) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Role not found" }), 404);
  }

  const slug = body.slug ?? (body.name ? createRoleSlug(body.name) : undefined);

  if (slug) {
    const slugConflict = await findRoleSlugConflict(slug, id);

    if (slugConflict) {
      return c.json(
        createErrorResponse({
          error: "Conflict",
          message: "Role with this slug already exists",
        }),
        409
      );
    }
  }

  await db
    .update(rbacRole)
    .set({
      name: body.name,
      slug,
      description: body.description,
      isActive: body.isActive,
    })
    .where(eq(rbacRole.id, id));

  const updatedRole = await findRoleDetailsById(id);

  return c.json(createSuccessResponse(updatedRole), 200);
});

registerOpenApiRoute(proptryxRolesPermissionGroup, remove, async (c) => {
  const { id } = c.req.valid("param");
  const existingRole = await findRoleDetailsById(id);

  if (!existingRole) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Role not found" }), 404);
  }

  await db.delete(rbacRole).where(eq(rbacRole.id, id));

  return c.json(createSuccessResponse(existingRole), 200);
});

registerOpenApiRoute(proptryxRolesPermissionGroup, create_permission, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const role = await findRoleDetailsById(id);

  if (!role) {
    return c.json(createErrorResponse({ error: "Not Found", message: "Role not found" }), 404);
  }

  if (isManagedRolePermissionResource(body.resource)) {
    const existingManagedPermission = role.permissions.find((permission: { resource: string }) =>
      isManagedRolePermissionResource(permission.resource)
    );

    if (existingManagedPermission) {
      return c.json(createSuccessResponse(existingManagedPermission), 200);
    }
  }

  const permissionInput = normalizeManagedRolePermission(body, "proptryx");

  const [permission] = await db
    .insert(rbacRolePermission)
    .values(createPermissionValues(id, permissionInput))
    .returning();

  return c.json(createSuccessResponse(permission), 201);
});

registerOpenApiRoute(proptryxRolesPermissionGroup, update_permission, async (c) => {
  const { roleId, permissionId } = c.req.valid("param");
  const body = c.req.valid("json");
  const existingPermission = await findPermissionById(roleId, permissionId);

  if (!existingPermission) {
    return c.json(
      createErrorResponse({ error: "Not Found", message: "Permission not found" }),
      404
    );
  }

  const resource = existingPermission.resource;
  const permissionInput = normalizeManagedRolePermission(
    {
      resource,
      accessLevel: body.accessLevel ?? existingPermission.accessLevel,
      actions: body.actions ?? existingPermission.actions,
    },
    "proptryx"
  );

  const [permission] = await db
    .update(rbacRolePermission)
    .set({
      resource: permissionInput.resource,
      ...normalizePermissionValues(permissionInput),
    })
    .where(eq(rbacRolePermission.id, permissionId))
    .returning();

  return c.json(createSuccessResponse(permission), 200);
});

registerOpenApiRoute(proptryxRolesPermissionGroup, remove_permission, async (c) => {
  const { roleId, permissionId } = c.req.valid("param");
  const existingPermission = await findPermissionById(roleId, permissionId);

  if (!existingPermission) {
    return c.json(
      createErrorResponse({ error: "Not Found", message: "Permission not found" }),
      404
    );
  }

  if (isManagedRolePermissionResource(existingPermission.resource)) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: "Account permission is managed automatically for every role",
      }),
      400
    );
  }

  await db.delete(rbacRolePermission).where(eq(rbacRolePermission.id, permissionId));

  return c.json(createSuccessResponse(existingPermission), 200);
});
