import { relations } from "drizzle-orm";
import { boolean, index, pgTable, real, text, uuid } from "drizzle-orm/pg-core";
import { HandoverType, PriceUnit } from "./enums";
import { property } from "./property";

export const propertyOwnerTemporary = pgTable(
  "property_owner_temporary",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: text("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    phoneNumber: text("phone_number"),

    distributionBlockId: text("distribution_block_id"),
    floorNumber: text("floor_number"),
    allocatedAreaSqft: real("allocated_area_sqft"),
    areaDescription: text("area_description"),
    handoverType: HandoverType("handover_type"),
    pricePerUnit: real("price_per_unit"),
    priceUnit: PriceUnit("price_unit"),
    priceNegotiable: boolean("price_negotiable"),
  },
  (table) => [
    index("property_owner_temporary_propertyId_idx").on(table.propertyId),
    index("property_owner_temporary_email_idx").on(table.email),
    index("property_owner_temporary_phoneNumber_idx").on(table.phoneNumber),
  ]
);

export const propertyOwnerTemporaryRelations = relations(propertyOwnerTemporary, ({ one }) => ({
  property: one(property, {
    fields: [propertyOwnerTemporary.propertyId],
    references: [property.id],
  }),
}));
