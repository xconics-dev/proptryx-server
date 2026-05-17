import { getRbacResourceMetadata, type RbacResourceScope } from "@proptryx/database";

export type OrganizationRoleSlug = "owner" | "admin" | "executive" | "property_owner";
export type RolePermissionAccessLevel = "company" | "user" | "all";
type ManagedRolePermissionScope = RbacResourceScope;

type PermissionActionMap = Record<string, boolean>;
type RolePermissionInput = {
  resource: string;
  accessLevel?: RolePermissionAccessLevel;
  actions?: PermissionActionMap;
};

type RoleResourceOverride = {
  accessLevel?: RolePermissionAccessLevel;
  actions?: PermissionActionMap;
};

type RolePreset = {
  role: Uppercase<OrganizationRoleSlug>;
  permissions: Array<{
    resource: string;
    label: string;
    accessLevel: RolePermissionAccessLevel;
    actions: PermissionActionMap;
  }>;
};

const COMPANY_SCOPE: RbacResourceScope = "company";
const COMPANY_RESOURCE_METADATA = getRbacResourceMetadata(COMPANY_SCOPE);
const PROPTRYX_SCOPE: RbacResourceScope = "proptryx";
const PROPTRYX_RESOURCE_METADATA = getRbacResourceMetadata(PROPTRYX_SCOPE);
export const MANAGED_ACCOUNT_PERMISSION_RESOURCE = "account";
export const MANAGED_ACCOUNT_PERMISSION_ACCESS_LEVEL = "user";
export const MANAGED_SESSION_PERMISSION_RESOURCE = "session";
export const MANAGED_SESSION_PERMISSION_ACCESS_LEVEL = "user";
export const MANAGED_USER_PERMISSION_RESOURCE = "user";
export const MANAGED_USER_PERMISSION_ACCESS_LEVEL = "user";
export const MANAGED_MEMBER_PERMISSION_RESOURCE = "member";
export const MANAGED_MEMBER_PERMISSION_ACCESS_LEVEL = "user";
const PROPERTY_PERMISSION_RESOURCE = "property";
const PROPERTY_PERMISSION_ACCESS_LEVEL = "user";
const PROPERTY_READ_ACTIONS: PermissionActionMap = {
  get: true,
  getAll: true,
};

const RESOURCE_ACTIONS = Object.freeze(
  Object.fromEntries(COMPANY_RESOURCE_METADATA.map((item) => [item.resource, item.actions]))
);
const PROPTRYX_RESOURCE_ACTIONS = Object.freeze(
  Object.fromEntries(PROPTRYX_RESOURCE_METADATA.map((item) => [item.resource, item.actions]))
);

const MANAGED_ROLE_PERMISSIONS_BY_SCOPE: Record<
  ManagedRolePermissionScope,
  Array<{
    resource: string;
    accessLevel: RolePermissionAccessLevel;
  }>
> = {
  company: [
    {
      resource: MANAGED_ACCOUNT_PERMISSION_RESOURCE,
      accessLevel: MANAGED_ACCOUNT_PERMISSION_ACCESS_LEVEL,
    },
    {
      resource: MANAGED_SESSION_PERMISSION_RESOURCE,
      accessLevel: MANAGED_SESSION_PERMISSION_ACCESS_LEVEL,
    },
    {
      resource: MANAGED_USER_PERMISSION_RESOURCE,
      accessLevel: MANAGED_USER_PERMISSION_ACCESS_LEVEL,
    },
  ],
  proptryx: [
    {
      resource: MANAGED_ACCOUNT_PERMISSION_RESOURCE,
      accessLevel: MANAGED_ACCOUNT_PERMISSION_ACCESS_LEVEL,
    },
    {
      resource: MANAGED_SESSION_PERMISSION_RESOURCE,
      accessLevel: MANAGED_SESSION_PERMISSION_ACCESS_LEVEL,
    },
    {
      resource: MANAGED_USER_PERMISSION_RESOURCE,
      accessLevel: MANAGED_USER_PERMISSION_ACCESS_LEVEL,
    },
  ],
};

const fullActions = (resource: string): PermissionActionMap =>
  Object.fromEntries((RESOURCE_ACTIONS[resource] ?? []).map((action) => [action, true]));
const fullActionsByScope = (scope: RbacResourceScope, resource: string): PermissionActionMap =>
  Object.fromEntries(
    ((scope === COMPANY_SCOPE ? RESOURCE_ACTIONS : PROPTRYX_RESOURCE_ACTIONS)[resource] ?? []).map(
      (action) => [action, true]
    )
  );

const getManagedRolePermissionConfigs = (scope: ManagedRolePermissionScope) =>
  MANAGED_ROLE_PERMISSIONS_BY_SCOPE[scope];

export const isManagedRolePermissionResource = (resource: string) =>
  Object.values(MANAGED_ROLE_PERMISSIONS_BY_SCOPE).some((permissions) =>
    permissions.some((permission) => permission.resource === resource)
  );

const buildManagedRolePermission = (
  scope: ManagedRolePermissionScope,
  resource: string,
  accessLevel: RolePermissionAccessLevel
): Required<RolePermissionInput> => ({
  resource,
  accessLevel,
  actions: fullActionsByScope(scope, resource),
});

export const getManagedRolePermission = (scope: RbacResourceScope): Required<RolePermissionInput> =>
  buildManagedRolePermission(
    scope,
    MANAGED_ACCOUNT_PERMISSION_RESOURCE,
    MANAGED_ACCOUNT_PERMISSION_ACCESS_LEVEL
  );

export const getManagedRolePermissions = (
  scope: ManagedRolePermissionScope
): Required<RolePermissionInput>[] =>
  getManagedRolePermissionConfigs(scope).map((permission) =>
    buildManagedRolePermission(scope, permission.resource, permission.accessLevel)
  );

export const mergeManagedRolePermissions = <T extends RolePermissionInput>(
  permissions: readonly T[] | undefined,
  scope: ManagedRolePermissionScope
) => {
  const managedPermissions = getManagedRolePermissions(scope);
  const filteredPermissions = (permissions ?? []).filter(
    (permission) => !isManagedRolePermissionResource(permission.resource)
  );

  return [...filteredPermissions, ...managedPermissions];
};

export const normalizeManagedRolePermission = <T extends RolePermissionInput>(
  permission: T,
  scope: ManagedRolePermissionScope
) => {
  if (!isManagedRolePermissionResource(permission.resource)) {
    return permission;
  }

  const managedPermission = getManagedRolePermissions(scope).find(
    (managedItem) => managedItem.resource === permission.resource
  );

  if (!managedPermission) {
    return permission;
  }

  return {
    ...permission,
    ...managedPermission,
  };
};

const ROLE_RESOURCE_OVERRIDES: Record<
  OrganizationRoleSlug,
  {
    defaultAccessLevel: RolePermissionAccessLevel;
    defaultActions: (resource: string) => PermissionActionMap;
    includeAllResources?: boolean;
    resources?: Record<string, RoleResourceOverride>;
  }
> = {
  owner: {
    defaultAccessLevel: "company",
    defaultActions: fullActions,
    includeAllResources: true,
    resources: {
      [MANAGED_ACCOUNT_PERMISSION_RESOURCE]: getManagedRolePermission(COMPANY_SCOPE),
      [MANAGED_SESSION_PERMISSION_RESOURCE]: buildManagedRolePermission(
        COMPANY_SCOPE,
        MANAGED_SESSION_PERMISSION_RESOURCE,
        MANAGED_SESSION_PERMISSION_ACCESS_LEVEL
      ),
      [MANAGED_USER_PERMISSION_RESOURCE]: buildManagedRolePermission(
        COMPANY_SCOPE,
        MANAGED_USER_PERMISSION_RESOURCE,
        MANAGED_USER_PERMISSION_ACCESS_LEVEL
      ),
    },
  },
  admin: {
    defaultAccessLevel: "company",
    defaultActions: fullActions,
    includeAllResources: true,
    resources: {
      [MANAGED_ACCOUNT_PERMISSION_RESOURCE]: getManagedRolePermission(COMPANY_SCOPE),
      [MANAGED_SESSION_PERMISSION_RESOURCE]: buildManagedRolePermission(
        COMPANY_SCOPE,
        MANAGED_SESSION_PERMISSION_RESOURCE,
        MANAGED_SESSION_PERMISSION_ACCESS_LEVEL
      ),
      [MANAGED_USER_PERMISSION_RESOURCE]: buildManagedRolePermission(
        COMPANY_SCOPE,
        MANAGED_USER_PERMISSION_RESOURCE,
        MANAGED_USER_PERMISSION_ACCESS_LEVEL
      ),
    },
  },
  executive: {
    defaultAccessLevel: "user",
    defaultActions: fullActions,
    resources: {
      [MANAGED_ACCOUNT_PERMISSION_RESOURCE]: getManagedRolePermission(COMPANY_SCOPE),
      [MANAGED_SESSION_PERMISSION_RESOURCE]: buildManagedRolePermission(
        COMPANY_SCOPE,
        MANAGED_SESSION_PERMISSION_RESOURCE,
        MANAGED_SESSION_PERMISSION_ACCESS_LEVEL
      ),
      [MANAGED_USER_PERMISSION_RESOURCE]: buildManagedRolePermission(
        COMPANY_SCOPE,
        MANAGED_USER_PERMISSION_RESOURCE,
        MANAGED_USER_PERMISSION_ACCESS_LEVEL
      ),
      [PROPERTY_PERMISSION_RESOURCE]: {
        accessLevel: PROPERTY_PERMISSION_ACCESS_LEVEL,
        actions: fullActions(PROPERTY_PERMISSION_RESOURCE),
      },
    },
  },
  property_owner: {
    defaultAccessLevel: "user",
    defaultActions: fullActions,
    resources: {
      [MANAGED_ACCOUNT_PERMISSION_RESOURCE]: getManagedRolePermission(COMPANY_SCOPE),
      [MANAGED_SESSION_PERMISSION_RESOURCE]: buildManagedRolePermission(
        COMPANY_SCOPE,
        MANAGED_SESSION_PERMISSION_RESOURCE,
        MANAGED_SESSION_PERMISSION_ACCESS_LEVEL
      ),
      [MANAGED_USER_PERMISSION_RESOURCE]: buildManagedRolePermission(
        COMPANY_SCOPE,
        MANAGED_USER_PERMISSION_RESOURCE,
        MANAGED_USER_PERMISSION_ACCESS_LEVEL
      ),
      [MANAGED_MEMBER_PERMISSION_RESOURCE]: {
        accessLevel: MANAGED_MEMBER_PERMISSION_ACCESS_LEVEL,
        actions: fullActions(MANAGED_MEMBER_PERMISSION_RESOURCE),
      },
      [PROPERTY_PERMISSION_RESOURCE]: {
        accessLevel: PROPERTY_PERMISSION_ACCESS_LEVEL,
        actions: PROPERTY_READ_ACTIONS,
      },
    },
  },
};

export const DEFAULT_ROLE_PERMISSION_PRESETS: readonly RolePreset[] = (
  Object.entries(ROLE_RESOURCE_OVERRIDES) as Array<
    [OrganizationRoleSlug, (typeof ROLE_RESOURCE_OVERRIDES)[OrganizationRoleSlug]]
  >
).map(([roleSlug, rolePreset]) => ({
  role: roleSlug.toUpperCase() as Uppercase<OrganizationRoleSlug>,
  permissions: COMPANY_RESOURCE_METADATA.filter(
    (resourceMeta) =>
      rolePreset.includeAllResources || rolePreset.resources?.[resourceMeta.resource]
  ).map((resourceMeta) => {
    const override = rolePreset.resources?.[resourceMeta.resource];
    return {
      resource: resourceMeta.resource,
      label: resourceMeta.label,
      accessLevel: override?.accessLevel ?? rolePreset.defaultAccessLevel,
      actions: override?.actions ?? rolePreset.defaultActions(resourceMeta.resource),
    };
  }),
}));

export const DEFAULT_ROLE_PERMISSION_PRESETS_BY_SLUG = Object.freeze(
  Object.fromEntries(
    DEFAULT_ROLE_PERMISSION_PRESETS.map((preset) => [preset.role.toLowerCase(), preset.permissions])
  ) as Record<OrganizationRoleSlug, RolePreset["permissions"]>
);
