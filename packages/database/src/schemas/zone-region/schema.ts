import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const region = pgTable(
  "region",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [uniqueIndex("region_name_uidx").on(table.name)]
);

export const zone = pgTable(
  "zone",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    regionId: text("region_id")
      .notNull()
      .references(() => region.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("zone_regionId_idx").on(table.regionId),
    uniqueIndex("zone_regionId_name_uidx").on(table.regionId, table.name),
  ]
);

export const regionRelations = relations(region, ({ many }) => ({
  zones: many(zone),
}));

export const zoneRelations = relations(zone, ({ one }) => ({
  region: one(region, {
    fields: [zone.regionId],
    references: [region.id],
  }),
}));
