import { relations } from "drizzle-orm";
import { boolean, index, pgTable, real, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "../../auth/schema";
import { createAuditRelationNames } from "../../utils/audit";

const auditRelations = createAuditRelationNames("testimonial");

export const testimonial = pgTable(
  "testimonial",
  {
    id: text("id").primaryKey(),
    image: text("image"),
    authorName: text("author_name").notNull(),
    isArchived: boolean("is_archived").default(false).notNull(),
    designation: text("designation"),
    description: text("description").notNull(),
    ratings: real("ratings").notNull(),
    // For soft deletion
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
    index("testimonial_author_name_idx").on(table.authorName),
    index("testimonial_isDeleted_isArchived_createdAt_idx").on(
      table.isDeleted,
      table.isArchived,
      table.createdAt
    ),
  ]
);

export const testimonialRelations = relations(testimonial, ({ one }) => {
  const auditUser = (
    field:
      | typeof testimonial.createdByUser
      | typeof testimonial.updatedByUser
      | typeof testimonial.deletedByUser,
    relationName: (typeof auditRelations)[keyof typeof auditRelations]
  ) =>
    one(user, {
      fields: [field],
      references: [user.id],
      relationName,
    });

  return {
    createdByUser: auditUser(testimonial.createdByUser, auditRelations.created),
    updatedByUser: auditUser(testimonial.updatedByUser, auditRelations.updated),
    deletedByUser: auditUser(testimonial.deletedByUser, auditRelations.deleted),
  };
});
