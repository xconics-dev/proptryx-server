import { pgEnum } from "drizzle-orm/pg-core";

export const PropertyType = pgEnum("property_type", [
  "RETAIL",
  "OFFICE",
  "WAREHOUSE",
  "COMMERCIAL_PARKING",
]);
export type PropertyType = (typeof PropertyType.enumValues)[number];
export const PropertyStatus = pgEnum("property_status", [
  "VACANT",
  "BUILD_TO_SUITE",
  "READY_TO_MOVE",
  "UNDER_NEGOTIATION",
  "BOOKED",
  "CLOSED",
  "ON_HOLD",
]);
export type PropertyStatus = (typeof PropertyStatus.enumValues)[number];
