import { boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { MeetingStatus, MeetingType } from "./enums";
import { user } from "../auth/schema";
import { property } from "../property/schema";

export const meeting = pgTable(
  "meeting",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    type: MeetingType("type").default("MEETING").notNull(),
    status: MeetingStatus("status").default("SCHEDULED").notNull(),
    agenda: text("agenda"), // before meeting note
    requestNote: text("request_note"),
    // location details
    location: text("location"),
    latitude: text("latitude"),
    longitude: text("longitude"),

    mom: text("mom"), // after meeting note, minutes of meeting
    requestedAt: timestamp("requested_at").defaultNow().notNull(),
    scheduledAt: timestamp("scheduled_at"),
    confirmedAt: timestamp("confirmed_at"),
    completedAt: timestamp("completed_at"),
    cancelledAt: timestamp("cancelled_at"),
    cancellationReason: text("cancellation_reason"),
    momPublishedAt: timestamp("mom_published_at"),

    // relations
    buyerId: text("buyer_id").references(() => user.id, {
      onDelete: "set null",
    }),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    sellerId: text("seller_id").references(() => user.id, {
      onDelete: "set null",
    }),
    requestedByUser: text("requested_by_user").references(() => user.id, {
      onDelete: "set null",
    }),

    createdByUser: text("created_by_user").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedByUser: text("updated_by_user").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),

    isDeleted: boolean("is_deleted").default(false).notNull(),
    deletedAt: timestamp("deleted_at"),
    deletedByUser: text("deleted_by_user").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("meeting_propertyId_idx").on(table.propertyId),
    index("meeting_buyerId_idx").on(table.buyerId),
    index("meeting_sellerId_idx").on(table.sellerId),
    index("meeting_requestedByUser_idx").on(table.requestedByUser),
    index("meeting_type_idx").on(table.type),
    index("meeting_status_idx").on(table.status),
    index("meeting_requestedAt_idx").on(table.requestedAt),
    index("meeting_scheduledAt_idx").on(table.scheduledAt),
    index("meeting_isDeleted_type_status_requestedAt_idx").on(
      table.isDeleted,
      table.type,
      table.status,
      table.requestedAt
    ),
  ]
);
