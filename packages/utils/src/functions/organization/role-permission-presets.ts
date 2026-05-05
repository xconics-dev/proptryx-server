import { getRbacResourceMetadata, type RbacResourceScope } from "@proptryx/database";

export type OrganizationRoleSlug = "owner" | "admin" | "executive";
export type RolePermissionAccessLevel = "company" | "user" | "all";

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
const DEFAULT_COMPANY_MEMBER_BASE_RESOURCES = [
  "account",
  "member",
  "organization",
  "rbac_role",
  "rbac_role_permission",
  "region",
  "user",
  "zone",
] as const;
const EXECUTIVE_EXTRA_RESOURCES = ["faq", "meeting", "property", "testimonial"] as const;

const RESOURCE_ACTIONS = Object.freeze(
  Object.fromEntries(COMPANY_RESOURCE_METADATA.map((item) => [item.resource, item.actions]))
);
const PROPTRYX_RESOURCE_ACTIONS = Object.freeze(
  Object.fromEntries(PROPTRYX_RESOURCE_METADATA.map((item) => [item.resource, item.actions]))
);

const fullActions = (resource: string): PermissionActionMap =>
  Object.fromEntries((RESOURCE_ACTIONS[resource] ?? []).map((action) => [action, true]));
const fullActionsByScope = (scope: RbacResourceScope, resource: string): PermissionActionMap =>
  Object.fromEntries(
    ((scope === COMPANY_SCOPE ? RESOURCE_ACTIONS : PROPTRYX_RESOURCE_ACTIONS)[resource] ?? []).map(
      (action) => [action, true]
    )
  );

export const isManagedRolePermissionResource = (resource: string) =>
  resource === MANAGED_ACCOUNT_PERMISSION_RESOURCE;

export const getManagedRolePermission = (
  scope: RbacResourceScope
): Required<RolePermissionInput> => ({
  resource: MANAGED_ACCOUNT_PERMISSION_RESOURCE,
  accessLevel: MANAGED_ACCOUNT_PERMISSION_ACCESS_LEVEL,
  actions: fullActionsByScope(scope, MANAGED_ACCOUNT_PERMISSION_RESOURCE),
});

export const mergeManagedRolePermissions = <T extends RolePermissionInput>(
  permissions: readonly T[] | undefined,
  scope: RbacResourceScope
) => {
  const managedPermission = getManagedRolePermission(scope);
  const filteredPermissions = (permissions ?? []).filter(
    (permission) => !isManagedRolePermissionResource(permission.resource)
  );

  return [...filteredPermissions, managedPermission];
};

export const normalizeManagedRolePermission = <T extends RolePermissionInput>(
  permission: T,
  scope: RbacResourceScope
) => {
  if (!isManagedRolePermissionResource(permission.resource)) {
    return permission;
  }

  return {
    ...permission,
    ...getManagedRolePermission(scope),
  };
};

const ROLE_RESOURCE_OVERRIDES: Record<
  OrganizationRoleSlug,
  {
    defaultAccessLevel: RolePermissionAccessLevel;
    defaultActions: (resource: string) => PermissionActionMap;
    includeResources?: readonly string[];
    resources?: Record<string, RoleResourceOverride>;
  }
> = {
  owner: {
    defaultAccessLevel: "company",
    defaultActions: fullActions,
    resources: {
      [MANAGED_ACCOUNT_PERMISSION_RESOURCE]: getManagedRolePermission(COMPANY_SCOPE),
    },
  },
  admin: {
    defaultAccessLevel: "company",
    defaultActions: fullActions,
    resources: {
      [MANAGED_ACCOUNT_PERMISSION_RESOURCE]: getManagedRolePermission(COMPANY_SCOPE),
    },
  },
  executive: {
    defaultAccessLevel: "company",
    defaultActions: fullActions,
    includeResources: [...DEFAULT_COMPANY_MEMBER_BASE_RESOURCES, ...EXECUTIVE_EXTRA_RESOURCES],
    resources: {
      [MANAGED_ACCOUNT_PERMISSION_RESOURCE]: getManagedRolePermission(COMPANY_SCOPE),
    },
  },
};

export const DEFAULT_ROLE_PERMISSION_PRESETS: readonly RolePreset[] = (
  Object.entries(ROLE_RESOURCE_OVERRIDES) as Array<
    [OrganizationRoleSlug, (typeof ROLE_RESOURCE_OVERRIDES)[OrganizationRoleSlug]]
  >
).map(([roleSlug, rolePreset]) => ({
  role: roleSlug.toUpperCase() as Uppercase<OrganizationRoleSlug>,
  permissions: COMPANY_RESOURCE_METADATA.filter((resourceMeta) =>
    rolePreset.includeResources ? rolePreset.includeResources.includes(resourceMeta.resource) : true
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
