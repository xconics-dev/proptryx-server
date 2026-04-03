import { relations } from "drizzle-orm";
import { index, integer, pgTable, real, unique, uuid } from "drizzle-orm/pg-core";
import {
  ParkingAccessType,
  ParkingConfiguration,
  ParkingSecurityControl,
  ParkingType,
  ParkingVentilationType,
} from "./enums";
import { property } from "./property";

export const propertyParking = pgTable(
  "property_parking",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),

    parkingType: ParkingType("parking_type").notNull(),
    parkingConfiguration: ParkingConfiguration("parking_configuration").notNull(),
    totalCapacity: integer("total_capacity"),
    accessType: ParkingAccessType("access_type"),
    /** Multi-select — a single asset may have RFID + CCTV etc. */
    securityControl: ParkingSecurityControl("security_control").array().default([]).notNull(),
    ventilationType: ParkingVentilationType("ventilation_type"),
    /** Minimum vehicle clearance height (in feet) */
    heightClearanceFt: real("height_clearance_ft"),
  },
  (table) => [
    unique("property_parking_propertyId_unique").on(table.propertyId),
    index("property_parking_parkingType_idx").on(table.parkingType),
    index("property_parking_accessType_idx").on(table.accessType),
  ]
);

export const propertyParkingRelations = relations(propertyParking, ({ one }) => ({
  property: one(property, {
    fields: [propertyParking.propertyId],
    references: [property.id],
  }),
}));
