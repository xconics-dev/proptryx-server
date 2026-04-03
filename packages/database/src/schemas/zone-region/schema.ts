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
import { propertyZone } from "../property/schema";
import { user } from "../auth/schema";

export const region = pgTable(
  "region",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    description: text("description"),

    // For keep reference
    createdByUser: text("created_by_user").references((): AnyPgColumn => user.id, {
      onDelete: "set null",
    }),
    updatedByUser: text("updated_by_user").references((): AnyPgColumn => user.id, {
      onDelete: "set null",
    }),
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
    // For keep reference
    createdByUser: text("created_by_user").references((): AnyPgColumn => user.id, {
      onDelete: "set null",
    }),
    updatedByUser: text("updated_by_user").references((): AnyPgColumn => user.id, {
      onDelete: "set null",
    }),
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
  createdBy: one(user, {
    fields: [region.createdByUser],
    references: [user.id],
    relationName: "regionCreatedByUser",
  }),
  updatedBy: one(user, {
    fields: [region.updatedByUser],
    references: [user.id],
    relationName: "regionUpdatedByUser",
  }),
}));

export const zoneRelations = relations(zone, ({ many, one }) => ({
  region: one(region, {
    fields: [zone.regionId],
    references: [region.id],
  }),
  propertyZones: many(propertyZone, {
    relationName: "zonePropertyZones",
  }),
  deletedBy: one(user, {
    fields: [zone.deletedByUser],
    references: [user.id],
    relationName: "zoneDeletedByUser",
  }),
  createdBy: one(user, {
    fields: [zone.createdByUser],
    references: [user.id],
    relationName: "zoneCreatedByUser",
  }),
  updatedBy: one(user, {
    fields: [zone.updatedByUser],
    references: [user.id],
    relationName: "zoneUpdatedByUser",
  }),
}));
