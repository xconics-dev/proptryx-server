import { relations, sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createAuditRelationNames } from "../../../utils/audit";
import { user } from "../../../auth";

const auditRelations = createAuditRelationNames("brokerRequest");

export const broker_request = pgTable(
  "broker_request",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    phoneNumber: text("phone_number").notNull(),
    pincode: text("pincode").notNull(),
    address: text("address"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    createdByUser: text("created_by_user").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedByUser: text("updated_by_user").references(() => user.id, {
      onDelete: "set null",
    }),
    // For soft deletion
    isDeleted: boolean("is_deleted").default(false).notNull(),
    deletedAt: timestamp("deleted_at"),
    deletedByUser: text("deleted_by_user").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [
    index("broker_request_email_idx").on(table.email),
    index("broker_request_phone_idx").on(table.phoneNumber),
    index("broker_request_isDeleted_createdAt_idx").on(table.isDeleted, table.createdAt),
    index("broker_request_name_trgm_idx")
      .using("gin", sql`lower(${table.name}) gin_trgm_ops`)
      .where(sql`${table.isDeleted} = false`),
    index("broker_request_email_trgm_idx")
      .using("gin", sql`lower(${table.email}) gin_trgm_ops`)
      .where(sql`${table.isDeleted} = false`),
    index("broker_request_phone_trgm_idx")
      .using("gin", sql`lower(${table.phoneNumber}) gin_trgm_ops`)
      .where(sql`${table.isDeleted} = false`),
  ]
);

export const brokerRequestRelations = relations(broker_request, ({ one }) => {
  const auditUser = (
    field:
      | typeof broker_request.createdByUser
      | typeof broker_request.updatedByUser
      | typeof broker_request.deletedByUser,
    relationName: (typeof auditRelations)[keyof typeof auditRelations]
  ) =>
    one(user, {
      fields: [field],
      references: [user.id],
      relationName,
    });

  return {
    createdByUser: auditUser(broker_request.createdByUser, auditRelations.created),
    updatedByUser: auditUser(broker_request.updatedByUser, auditRelations.updated),
    deletedByUser: auditUser(broker_request.deletedByUser, auditRelations.deleted),
  };
});
