import { getTableColumns, getTableName, type Table } from "drizzle-orm";
import {
  account,
  broker_request,
  company_request,
  faq,
  invitation,
  meeting,
  member,
  organization,
  organizationSubscription,
  property,
  rbacRole,
  rbacRolePermission,
  region,
  session,
  subscriptionPlans,
  testimonial,
  user,
  zone,
} from "./schemas";
import { DATABASE_RESOURCES, type DatabaseResource } from "./resources";

export type RbacResourceScope = "proptryx" | "company";

const DEFAULT_RESOURCE_ACTIONS = ["get", "getAll", "create", "update", "delete"] as const;

const ACTIONS: Partial<Record<DatabaseResource, readonly string[]>> = {
  meeting: [...DEFAULT_RESOURCE_ACTIONS, "publish"],
  organization: [...DEFAULT_RESOURCE_ACTIONS, "activate"],
  member: [...DEFAULT_RESOURCE_ACTIONS, "activate", "deactivate"],
  property: [...DEFAULT_RESOURCE_ACTIONS, "publish", "verify"],
  subscription_plans: [...DEFAULT_RESOURCE_ACTIONS, "activate", "deactivate"],
  organization_subscription: [...DEFAULT_RESOURCE_ACTIONS, "subscription", "terminate"],
  user: [...DEFAULT_RESOURCE_ACTIONS, "activate", "deactivate"],
};

const COMPANY_RESOURCES = new Set<DatabaseResource>([
  DATABASE_RESOURCES.account,
  DATABASE_RESOURCES.faq,
  DATABASE_RESOURCES.meeting,
  DATABASE_RESOURCES.member,
  DATABASE_RESOURCES.organization,
  DATABASE_RESOURCES.property,
  DATABASE_RESOURCES.rbac_role,
  DATABASE_RESOURCES.rbac_role_permission,
  DATABASE_RESOURCES.region,
  DATABASE_RESOURCES.session,
  DATABASE_RESOURCES.testimonial,
  DATABASE_RESOURCES.user,
  DATABASE_RESOURCES.zone,
]);

const RESOURCE_TABLES = {
  account,
  broker_request,
  company_request,
  faq,
  invitation,
  member,
  meeting,
  property,
  organization,
  organization_subscription: organizationSubscription,
  rbac_role: rbacRole,
  rbac_role_permission: rbacRolePermission,
  region,
  session,
  subscription_plans: subscriptionPlans,
  testimonial,
  user,
  zone,
} as const satisfies Record<DatabaseResource, Table>;

const toLabel = (resource: string) =>
  resource
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

const getScopes = (resource: DatabaseResource): RbacResourceScope[] =>
  COMPANY_RESOURCES.has(resource) ? ["proptryx", "company"] : ["proptryx"];

const getColumns = (table: Table) =>
  Object.entries(getTableColumns(table)).map(([key, column]) => ({
    key,
    name: column.name,
    dataType: column.dataType,
    columnType: column.columnType,
    notNull: column.notNull,
    hasDefault: column.hasDefault,
    enumValues: column.enumValues ?? [],
  }));

const RESOURCES = Object.freeze(
  Object.entries(RESOURCE_TABLES).map(([resource, table]) => ({
    resource: resource as DatabaseResource,
    tableName: getTableName(table),
    label: toLabel(resource),
    scopes: getScopes(resource as DatabaseResource),
    actions: ACTIONS[resource as DatabaseResource] ?? DEFAULT_RESOURCE_ACTIONS,
    columns: getColumns(table),
  }))
);

export function getRbacResourceMetadata(scope: RbacResourceScope) {
  return RESOURCES.filter((resource) => resource.scopes.includes(scope));
}
