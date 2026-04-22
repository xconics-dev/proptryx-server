import { relations, sql } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "../../auth/schema";
import { createAuditRelationNames } from "../../utils/audit";

const auditRelations = createAuditRelationNames("companyRequest");

export const company_request = pgTable(
  "company_request",
  {
    id: text("id").primaryKey(),
    ownerName: text("owner_name").notNull(),
    ownerEmail: text("owner_email").notNull(),
    ownerPhoneNumber: text("owner_phone").notNull(),
    companyGstNumber: text("company_gst_number").notNull(),
    companyEmail: text("company_email"),
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
    uniqueIndex("company_request_gst_number_uidx").on(table.companyGstNumber),
    index("company_request_owner_email_idx").on(table.ownerEmail),
    index("company_request_owner_phone_idx").on(table.ownerPhoneNumber),
    index("company_request_isDeleted_createdAt_idx").on(table.isDeleted, table.createdAt),
    index("company_request_owner_name_trgm_idx")
      .using("gin", sql`lower(${table.ownerName}) gin_trgm_ops`)
      .where(sql`${table.isDeleted} = false`),
    index("company_request_owner_email_trgm_idx")
      .using("gin", sql`lower(${table.ownerEmail}) gin_trgm_ops`)
      .where(sql`${table.isDeleted} = false`),
    index("company_request_owner_phone_trgm_idx")
      .using("gin", sql`lower(${table.ownerPhoneNumber}) gin_trgm_ops`)
      .where(sql`${table.isDeleted} = false`),
    index("company_request_company_gst_trgm_idx")
      .using("gin", sql`lower(${table.companyGstNumber}) gin_trgm_ops`)
      .where(sql`${table.isDeleted} = false`),
    index("company_request_company_email_trgm_idx")
      .using("gin", sql`lower(${table.companyEmail}) gin_trgm_ops`)
      .where(sql`${table.isDeleted} = false and ${table.companyEmail} is not null`),
  ]
);

export const companyRequestRelations = relations(company_request, ({ one }) => {
  const auditUser = (
    field:
      | typeof company_request.createdByUser
      | typeof company_request.updatedByUser
      | typeof company_request.deletedByUser,
    relationName: (typeof auditRelations)[keyof typeof auditRelations]
  ) =>
    one(user, {
      fields: [field],
      references: [user.id],
      relationName,
    });

  return {
    createdByUser: auditUser(company_request.createdByUser, auditRelations.created),
    updatedByUser: auditUser(company_request.updatedByUser, auditRelations.updated),
    deletedByUser: auditUser(company_request.deletedByUser, auditRelations.deleted),
  };
});

export * from "./broker";
