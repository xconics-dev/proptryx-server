import { relations } from "drizzle-orm";
import { boolean, index, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "../auth/schema";
import { PropertyMediaType, PropertyMediaVisibility } from "./enums";
import { property } from "./property";

export const propertyMedia = pgTable(
  "property_media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),

    mediaType: PropertyMediaType("media_type").notNull(),
    name: text("name").notNull(),
    storageKey: text("storage_key").notNull(),
    url: text("url").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    visibility: PropertyMediaVisibility("visibility").default("PUBLIC").notNull(),
    sortOrder: integer("sort_order").default(0),
    altText: text("alt_text"),
    isThumbnail: boolean("is_thumbnail").default(false).notNull(),

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
    index("property_media_propertyId_idx").on(table.propertyId),
    index("property_media_propertyId_mediaType_idx").on(table.propertyId, table.mediaType),
    index("property_media_propertyId_isThumbnail_idx").on(table.propertyId, table.isThumbnail),
    index("property_media_isDeleted_propertyId_idx").on(table.isDeleted, table.propertyId),
  ]
);

export const propertyMediaRelations = relations(propertyMedia, ({ one }) => ({
  property: one(property, {
    fields: [propertyMedia.propertyId],
    references: [property.id],
  }),
  createdByUser: one(user, {
    fields: [propertyMedia.createdByUser],
    references: [user.id],
    relationName: "propertyMediaCreatedByUser",
  }),
  updatedByUser: one(user, {
    fields: [propertyMedia.updatedByUser],
    references: [user.id],
    relationName: "propertyMediaUpdatedByUser",
  }),
  deletedByUser: one(user, {
    fields: [propertyMedia.deletedByUser],
    references: [user.id],
    relationName: "propertyMediaDeletedByUser",
  }),
}));
