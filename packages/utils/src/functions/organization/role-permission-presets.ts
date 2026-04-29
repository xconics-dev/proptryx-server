import { getRbacResourceMetadata, type RbacResourceScope } from "@proptryx/database";

export type OrganizationRoleSlug = "owner" | "admin" | "executive";
export type RolePermissionAccessLevel = "company" | "user" | "all";

type PermissionActionMap = Record<string, boolean>;

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

const RESOURCE_ACTIONS = Object.freeze(
  Object.fromEntries(COMPANY_RESOURCE_METADATA.map((item) => [item.resource, item.actions]))
);

const fullActions = (resource: string): PermissionActionMap =>
  Object.fromEntries((RESOURCE_ACTIONS[resource] ?? []).map((action) => [action, true]));

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
    defaultAccessLevel: "all",
    defaultActions: fullActions,
  },
  admin: {
    defaultAccessLevel: "all",
    defaultActions: fullActions,
  },
  executive: {
    defaultAccessLevel: "company",
    defaultActions: fullActions,
    includeResources: ["account", "property", "meeting", "faq", "testimonial"],
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
