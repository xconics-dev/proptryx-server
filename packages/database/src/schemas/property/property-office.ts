import { relations } from "drizzle-orm";
import { index, integer, pgTable, text, unique, uuid } from "drizzle-orm/pg-core";
import { BusinessDistrictType } from "./enums";
import { property } from "./property";

export const propertyOffice = pgTable(
  "property_office",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),

    floor: text("floor"),
    buildingName: text("building_name"),
    /** CBD = Central, SBD = Secondary, TBD = Territory/Outlying */
    businessDistrictType: BusinessDistrictType("business_district_type"),
    carParksAvailable: integer("car_parks_available"),
    toiletsCount: integer("toilets_count"),
  },
  (table) => [
    unique("property_office_propertyId_unique").on(table.propertyId),
    index("property_office_businessDistrictType_idx").on(table.businessDistrictType),
  ]
);

export const propertyOfficeRelations = relations(propertyOffice, ({ one }) => ({
  property: one(property, {
    fields: [propertyOffice.propertyId],
    references: [property.id],
  }),
}));
