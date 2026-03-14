import {
  getDB,
  orgMemberRole,
  rolePermission,
  type RolePermissionEntry,
  userRole,
} from "@proptryx/database";
import { asc, desc, isNotNull, isNull } from "drizzle-orm";
import { createAccessControl } from "better-auth/plugins/access";

type BuiltRole = ReturnType<ReturnType<typeof createAccessControl>["newRole"]>;
type PermissionMap = Record<string, string[]>;

type UserRoleRecord = {
  id: string;
  name: string;
};

type RolePermissionRecord = {
  permissions: RolePermissionEntry[] | null;
  roleId: string;
  subRoleId: string | null;
};

type RbacCatalog = {
  adminAccessControl: ReturnType<typeof createAccessControl>;
  adminRoleNames: string[];
  adminRoles: Record<string, BuiltRole>;
  defaultOrganizationRoleName: string;
  defaultUserRoleName: string;
  organizationAccessControl: ReturnType<typeof createAccessControl>;
  organizationRoles: Record<string, BuiltRole>;
  version: string;
};

const FALLBACK_USER_ROLE_NAME = "user";
const FALLBACK_ORGANIZATION_ROLE_NAME = "admin";
const FALLBACK_PERMISSION_MAP: PermissionMap = {};
const FALLBACK_ACCESS_CONTROL = createAccessControl(FALLBACK_PERMISSION_MAP);
const REFRESH_WINDOW_MS = 5_000;

const EMPTY_CATALOG: RbacCatalog = {
  adminAccessControl: FALLBACK_ACCESS_CONTROL,
  adminRoleNames: [],
  adminRoles: {
    [FALLBACK_USER_ROLE_NAME]: FALLBACK_ACCESS_CONTROL.newRole(FALLBACK_PERMISSION_MAP),
  },
  defaultOrganizationRoleName: FALLBACK_ORGANIZATION_ROLE_NAME,
  defaultUserRoleName: FALLBACK_USER_ROLE_NAME,
  organizationAccessControl: FALLBACK_ACCESS_CONTROL,
  organizationRoles: {
    [FALLBACK_ORGANIZATION_ROLE_NAME]: FALLBACK_ACCESS_CONTROL.newRole(FALLBACK_PERMISSION_MAP),
  },
  version: "fallback",
};

let cachedCatalog: RbacCatalog | null = null;
let inFlightCatalog: Promise<RbacCatalog> | null = null;
let lastLoadedAt = 0;

function toActionName(action: string, accessLevel: string) {
  return `${action}:${accessLevel}`;
}

function toPermissionMap(entries: RolePermissionEntry[] | null | undefined): PermissionMap {
  const permissionMap: PermissionMap = {};

  for (const entry of entries ?? []) {
    if (!entry?.persona || !entry.permissions) {
      continue;
    }

    const enabledActions = Object.entries(entry.permissions)
      .filter(([, allowed]) => allowed)
      .map(([action]) => toActionName(action, entry.accessLevel))
      .sort();

    if (enabledActions.length === 0) {
      continue;
    }

    permissionMap[entry.persona] = Array.from(
      new Set([...(permissionMap[entry.persona] ?? []), ...enabledActions])
    ).sort();
  }

  return permissionMap;
}

function mergePermissionMaps(...maps: PermissionMap[]): PermissionMap {
  const merged: PermissionMap = {};

  for (const map of maps) {
    for (const [persona, actions] of Object.entries(map)) {
      merged[persona] = Array.from(new Set([...(merged[persona] ?? []), ...actions])).sort();
    }
  }

  return merged;
}

function collectAccessControlResources(records: RolePermissionRecord[]) {
  return records.reduce<PermissionMap>(
    (resources, record) => mergePermissionMaps(resources, toPermissionMap(record.permissions)),
    {}
  );
}

function buildAdminRoleNames(roles: UserRoleRecord[]) {
  return roles.map((role) => role.name).filter((name) => name.toLowerCase().includes("admin"));
}

function pickDefaultRoleName(roleNames: string[], fallbackName: string) {
  return roleNames.includes(fallbackName) ? fallbackName : (roleNames[0] ?? fallbackName);
}

function indexPermissions(records: RolePermissionRecord[]) {
  const byRoleId = new Map<string, PermissionMap>();
  const byRoleAndSubRoleId = new Map<string, PermissionMap>();

  for (const record of records) {
    const permissionMap = toPermissionMap(record.permissions);
    const currentRolePermissions = byRoleId.get(record.roleId) ?? {};
    byRoleId.set(record.roleId, mergePermissionMaps(currentRolePermissions, permissionMap));

    if (record.subRoleId) {
      const key = `${record.roleId}:${record.subRoleId}`;
      const currentScopedPermissions = byRoleAndSubRoleId.get(key) ?? {};
      byRoleAndSubRoleId.set(key, mergePermissionMaps(currentScopedPermissions, permissionMap));
    }
  }

  return { byRoleAndSubRoleId, byRoleId };
}

async function readCatalogVersion() {
  const db = getDB();

  const [latestUserRole, latestOrgMemberRole, latestRolePermission] = await Promise.all([
    db
      .select({ updatedAt: userRole.updatedAt })
      .from(userRole)
      .orderBy(desc(userRole.updatedAt))
      .limit(1),
    db
      .select({ updatedAt: orgMemberRole.updatedAt })
      .from(orgMemberRole)
      .orderBy(desc(orgMemberRole.updatedAt))
      .limit(1),
    db
      .select({ updatedAt: rolePermission.updatedAt })
      .from(rolePermission)
      .orderBy(desc(rolePermission.updatedAt))
      .limit(1),
  ]);

  return [
    latestUserRole[0]?.updatedAt?.toISOString() ?? "no-user-roles",
    latestOrgMemberRole[0]?.updatedAt?.toISOString() ?? "no-org-member-roles",
    latestRolePermission[0]?.updatedAt?.toISOString() ?? "no-role-permissions",
  ].join("|");
}

async function buildCatalog(version: string): Promise<RbacCatalog> {
  const db = getDB();

  const [userRoles, orgMemberRoles, baseRolePermissions, scopedRolePermissions] = await Promise.all(
    [
      db
        .select({
          id: userRole.id,
          name: userRole.name,
        })
        .from(userRole)
        .orderBy(asc(userRole.name)),
      db
        .select({
          id: orgMemberRole.id,
          name: orgMemberRole.name,
          userRoleId: orgMemberRole.userRoleId,
        })
        .from(orgMemberRole)
        .orderBy(asc(orgMemberRole.name)),
      db
        .select({
          permissions: rolePermission.permissions,
          roleId: rolePermission.roleId,
          subRoleId: rolePermission.subRoleId,
        })
        .from(rolePermission)
        .where(isNull(rolePermission.subRoleId))
        .orderBy(asc(rolePermission.roleId)),
      db
        .select({
          permissions: rolePermission.permissions,
          roleId: rolePermission.roleId,
          subRoleId: rolePermission.subRoleId,
        })
        .from(rolePermission)
        .where(isNotNull(rolePermission.subRoleId))
        .orderBy(asc(rolePermission.roleId), asc(rolePermission.subRoleId)),
    ]
  );

  const allPermissionRecords = [...baseRolePermissions, ...scopedRolePermissions];
  const adminAccessControl = createAccessControl(
    collectAccessControlResources(baseRolePermissions)
  );
  const organizationAccessControl = createAccessControl(
    collectAccessControlResources(allPermissionRecords)
  );

  const { byRoleAndSubRoleId, byRoleId } = indexPermissions(allPermissionRecords);

  const adminRoles = Object.fromEntries(
    userRoles.map((role) => [
      role.name,
      adminAccessControl.newRole(byRoleId.get(role.id) ?? FALLBACK_PERMISSION_MAP),
    ])
  );

  const organizationRoles = Object.fromEntries(
    orgMemberRoles.map((subRole) => {
      const mergedPermissions = mergePermissionMaps(
        byRoleId.get(subRole.userRoleId) ?? FALLBACK_PERMISSION_MAP,
        byRoleAndSubRoleId.get(`${subRole.userRoleId}:${subRole.id}`) ?? FALLBACK_PERMISSION_MAP
      );

      return [subRole.name, organizationAccessControl.newRole(mergedPermissions)];
    })
  );

  return {
    adminAccessControl,
    adminRoleNames: buildAdminRoleNames(userRoles),
    adminRoles: Object.keys(adminRoles).length > 0 ? adminRoles : EMPTY_CATALOG.adminRoles,
    defaultOrganizationRoleName: pickDefaultRoleName(
      orgMemberRoles.map((role) => role.name),
      FALLBACK_ORGANIZATION_ROLE_NAME
    ),
    defaultUserRoleName: pickDefaultRoleName(
      userRoles.map((role) => role.name),
      FALLBACK_USER_ROLE_NAME
    ),
    organizationAccessControl,
    organizationRoles:
      Object.keys(organizationRoles).length > 0
        ? organizationRoles
        : EMPTY_CATALOG.organizationRoles,
    version,
  };
}

export async function loadRbacCatalog(forceRefresh = false): Promise<RbacCatalog> {
  if (!forceRefresh && cachedCatalog && Date.now() - lastLoadedAt < REFRESH_WINDOW_MS) {
    return cachedCatalog;
  }

  if (inFlightCatalog) {
    return inFlightCatalog;
  }

  inFlightCatalog = (async () => {
    try {
      const version = await readCatalogVersion();

      if (!forceRefresh && cachedCatalog && cachedCatalog.version === version) {
        lastLoadedAt = Date.now();
        return cachedCatalog;
      }

      const catalog = await buildCatalog(version);
      cachedCatalog = catalog;
      lastLoadedAt = Date.now();
      return catalog;
    } catch {
      cachedCatalog = EMPTY_CATALOG;
      lastLoadedAt = Date.now();
      return EMPTY_CATALOG;
    }
  })();

  try {
    return await inFlightCatalog;
  } finally {
    inFlightCatalog = null;
  }
}

export type { RbacCatalog };
