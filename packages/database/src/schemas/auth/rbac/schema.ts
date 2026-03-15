import { relations, sql } from "drizzle-orm";
import { index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { invitation, member, user } from "../schema";

export type RolePermissionAccessLevel = "company" | "user" | "all";

export type RolePermissionEntry = {
  persona: string;
  accessLevel: RolePermissionAccessLevel;
  permissions: Record<string, boolean>;
};

export const userRole = pgTable(
  "user_roles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("user_roles_name_uidx").on(table.name)]
);

export const orgMemberRole = pgTable(
  "org_member_roles",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    userRoleId: text("user_role_id")
      .notNull()
      .references(() => userRole.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("org_member_roles_userRoleId_idx").on(table.userRoleId),
    uniqueIndex("org_member_roles_name_uidx").on(table.name),
  ]
);

export const rolePermission = pgTable(
  "role_permissions",
  {
    id: text("id").primaryKey(),
    roleId: text("role_id")
      .notNull()
      .references(() => userRole.id, { onDelete: "cascade" }),
    subRoleId: text("sub_role_id").references(() => orgMemberRole.id, { onDelete: "cascade" }),
    permissions: jsonb("permissions")
      .$type<RolePermissionEntry[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("role_permissions_roleId_idx").on(table.roleId),
    index("role_permissions_subRoleId_idx").on(table.subRoleId),
    uniqueIndex("role_permissions_roleId_base_uidx")
      .on(table.roleId)
      .where(sql`${table.subRoleId} is null`),
    uniqueIndex("role_permissions_roleId_subRoleId_uidx")
      .on(table.roleId, table.subRoleId)
      .where(sql`${table.subRoleId} is not null`),
  ]
);

export const userRoleRelations = relations(userRole, ({ many }) => ({
  orgMemberRoles: many(orgMemberRole),
  rolePermissions: many(rolePermission),
  users: many(user),
}));

export const orgMemberRoleRelations = relations(orgMemberRole, ({ many, one }) => ({
  members: many(member),
  invitations: many(invitation),
  userRole: one(userRole, {
    fields: [orgMemberRole.userRoleId],
    references: [userRole.id],
  }),
  rolePermissions: many(rolePermission),
}));

export const rolePermissionRelations = relations(rolePermission, ({ one }) => ({
  role: one(userRole, {
    fields: [rolePermission.roleId],
    references: [userRole.id],
  }),
  subRole: one(orgMemberRole, {
    fields: [rolePermission.subRoleId],
    references: [orgMemberRole.id],
  }),
}));
