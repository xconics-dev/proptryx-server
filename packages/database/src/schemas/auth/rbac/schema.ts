import { boolean, pgTable, text, jsonb, timestamp, index, uniqueIndex } from "drizzle-orm/pg-core";
import { AccessPanel, PermissionAccessLevel } from "../enums";
import { relations, sql } from "drizzle-orm";
import { organization } from "../schema";

type RbacRolePermissionActions = Record<string, boolean>;

export const rbacRole = pgTable(
  "rbac_role",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    panel: AccessPanel("panel").notNull(),
    organizationId: text("organization_id").references(() => organization.id, {
      onDelete: "cascade",
    }),
    isSystem: boolean("is_system").default(false).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("rbac_role_panel_idx").on(table.panel),
    index("rbac_role_org_idx").on(table.organizationId),
    index("rbac_role_slug_idx").on(table.slug),
    index("rbac_role_panel_slug_idx").on(table.panel, table.slug),
  ]
);

export const rbacRolePermission = pgTable(
  "rbac_role_permission",
  {
    id: text("id").primaryKey(),
    roleId: text("role_id")
      .notNull()
      .references(() => rbacRole.id, { onDelete: "cascade" }),
    resource: text("resource").notNull(),
    accessLevel: PermissionAccessLevel("access_level").default("all").notNull(),
    actions: jsonb("actions")
      .$type<RbacRolePermissionActions>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("rbac_role_permission_role_resource_uidx").on(table.roleId, table.resource),
    index("rbac_role_permission_resource_idx").on(table.resource),
  ]
);

export const rbacRoleRelations = relations(rbacRole, ({ many, one }) => ({
  organization: one(organization, {
    fields: [rbacRole.organizationId],
    references: [organization.id],
  }),
  permissions: many(rbacRolePermission),
}));

export const rbacRolePermissionRelations = relations(rbacRolePermission, ({ one }) => ({
  role: one(rbacRole, {
    fields: [rbacRolePermission.roleId],
    references: [rbacRole.id],
  }),
}));
