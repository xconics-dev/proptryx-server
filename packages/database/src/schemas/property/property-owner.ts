import { relations } from "drizzle-orm";
import { boolean, index, pgTable, real, text, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "../auth/schema";
import { HandoverType, PriceUnit } from "./enums";
import { property } from "./property";

export const propertyOwner = pgTable(
  "property_owner",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),

    // Floor / area split — only populated when property.areaType = "SPLIT"
    floorNumber: text("floor_number"),
    allocatedAreaSqft: real("allocated_area_sqft"),
    /** Free-form label for the split segment, e.g. "North wing, floors 3–5" */
    areaDescription: text("area_description"),

    // Per-owner commercial terms for split ownership.
    // Null = inherit from the parent property defaults.
    handoverType: HandoverType("handover_type"),
    pricePerUnit: real("price_per_unit"),
    priceUnit: PriceUnit("price_unit"),
    priceNegotiable: boolean("price_negotiable"),
  },
  (table) => [
    unique("property_owner_propertyId_userId_unique").on(table.propertyId, table.userId),
    index("property_owner_propertyId_idx").on(table.propertyId),
    index("property_owner_userId_idx").on(table.userId),
  ]
);

export const propertyOwnerRelations = relations(propertyOwner, ({ one }) => ({
  property: one(property, {
    fields: [propertyOwner.propertyId],
    references: [property.id],
  }),
  user: one(user, {
    fields: [propertyOwner.userId],
    references: [user.id],
  }),
}));
