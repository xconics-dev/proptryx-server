import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { user } from "../auth";

export const region = pgTable(
  "region",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    description: text("description"),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),

    // For soft deletion
    isDeleted: boolean("is_deleted").default(false).notNull(),
    deletedAt: timestamp("deleted_at"),
    deletedByUser: text("deleted_by_user").references((): AnyPgColumn => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [uniqueIndex("region_name_uidx").on(table.name)]
);

export const zone = pgTable(
  "zone",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description"),
    regionId: text("region_id")
      .notNull()
      .references(() => region.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),

    // For soft deletion
    isDeleted: boolean("is_deleted").default(false).notNull(),
    deletedAt: timestamp("deleted_at"),
    deletedByUser: text("deleted_by_user").references((): AnyPgColumn => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("zone_regionId_idx").on(table.regionId),
    uniqueIndex("zone_regionId_name_uidx").on(table.regionId, table.name),
  ]
);

export const regionRelations = relations(region, ({ many, one }) => ({
  zones: many(zone),
  deletedBy: one(user, {
    fields: [region.deletedByUser],
    references: [user.id],
    relationName: "regionDeletedByUser",
  }),
}));

export const zoneRelations = relations(zone, ({ one }) => ({
  region: one(region, {
    fields: [zone.regionId],
    references: [region.id],
  }),
  deletedBy: one(user, {
    fields: [zone.deletedByUser],
    references: [user.id],
    relationName: "zoneDeletedByUser",
  }),
}));
