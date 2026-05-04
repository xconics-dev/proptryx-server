import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "../../auth/schema";
import { property } from "../../property/schema";
import { createAuditRelationNames } from "../../utils/audit";

const auditRelations = createAuditRelationNames("faq");

export const faq = pgTable(
  "faq",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: text("property_id").references(() => property.id, {
      onDelete: "set null",
    }),
    question: text("question").notNull(),
    answer: text("answer"),
    isArchived: boolean("is_archived").default(false).notNull(),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    deletedByUser: text("deleted_by_user").references(() => user.id, {
      onDelete: "set null",
    }),
    deletedAt: timestamp("deleted_at"),
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
  },
  (table) => [
    index("faq_property_id_idx").on(table.propertyId),
    index("faq_question_idx").on(table.question),
    index("faq_isDeleted_isArchived_createdAt_idx").on(
      table.isDeleted,
      table.isArchived,
      table.createdAt
    ),
  ]
);

export const faqRelations = relations(faq, ({ one }) => {
  const auditUser = (
    field: typeof faq.createdByUser | typeof faq.updatedByUser | typeof faq.deletedByUser,
    relationName: (typeof auditRelations)[keyof typeof auditRelations]
  ) =>
    one(user, {
      fields: [field],
      references: [user.id],
      relationName,
    });

  return {
    property: one(property, {
      fields: [faq.propertyId],
      references: [property.id],
    }),
    createdByUser: auditUser(faq.createdByUser, auditRelations.created),
    updatedByUser: auditUser(faq.updatedByUser, auditRelations.updated),
    deletedByUser: auditUser(faq.deletedByUser, auditRelations.deleted),
  };
});
