import { pgTable, text, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "../../auth";

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
    // For soft deletion
    isDeleted: boolean("is_deleted").default(false).notNull(),
    deletedAt: timestamp("deleted_at"),
    deletedByUser: text("deleted_by_user").references(() => user.id, { onDelete: "set null" }),
  },
  (table) => [uniqueIndex("company_request_gst_number_uidx").on(table.companyGstNumber)]
);
