import { relations } from "drizzle-orm";
import { index, pgTable, real, unique, uuid } from "drizzle-orm/pg-core";
import { WarehouseConstructionType } from "./enums";
import { property } from "./property";

export const propertyWarehouse = pgTable(
  "property_warehouse",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),

    /** Side height from ground to start of roof slope (in feet) */
    eavesHeightFt: real("eaves_height_ft"),
    /** Central peak height of the roof (in feet) */
    topHeightFt: real("top_height_ft"),
    constructionType: WarehouseConstructionType("construction_type"),
    /**
     * Ratio of top height to eaves height (topHeightFt / eavesHeightFt).
     * Stored explicitly so clients can filter/sort without recomputing.
     */
    heightRatio: real("height_ratio"),
  },
  (table) => [
    unique("property_warehouse_propertyId_unique").on(table.propertyId),
    index("property_warehouse_constructionType_idx").on(table.constructionType),
  ]
);

export const propertyWarehouseRelations = relations(propertyWarehouse, ({ one }) => ({
  property: one(property, {
    fields: [propertyWarehouse.propertyId],
    references: [property.id],
  }),
}));
