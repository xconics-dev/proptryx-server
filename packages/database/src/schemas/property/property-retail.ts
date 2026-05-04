import { relations } from "drizzle-orm";
import { index, pgTable, real, text, unique, uuid } from "drizzle-orm/pg-core";
import { RetailBrandCategory, RetailPropertyType, RetailStoreType } from "./enums";
import { property } from "./property";

export const propertyRetail = pgTable(
  "property_retail",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),

    propertyType: RetailPropertyType("property_type").notNull(),
    storeType: RetailStoreType("store_type").notNull(),
    /** Width of the front face visible from the main road (in feet) */
    frontageWidthFt: real("frontage_width_ft"),
    /** Floor-to-lowest-beam clearance (in feet) — critical for fit-outs */
    beamBottomHeightFt: real("beam_bottom_height_ft"),
    /** Names of neighbouring / adjoining brand outlets */
    neighbouringBrands: text("neighbouring_brands").array().default([]).notNull(),
    /** Type(s) of tenant / business mix at this location */
    brandCategories: RetailBrandCategory("brand_categories").array().default([]).notNull(),
  },
  (table) => [
    unique("property_retail_propertyId_unique").on(table.propertyId),
    index("property_retail_propertyType_idx").on(table.propertyType),
    index("property_retail_storeType_idx").on(table.storeType),
  ]
);

export const propertyRetailRelations = relations(propertyRetail, ({ one }) => ({
  property: one(property, {
    fields: [propertyRetail.propertyId],
    references: [property.id],
  }),
}));
