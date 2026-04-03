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

// ─── Area & Pricing ───────────────────────────────────────────────────────────

/** SINGLE = one contiguous unit; SPLIT = divided floor-wise or area-wise across multiple owners */
export const AreaType = pgEnum("area_type", ["SINGLE", "SPLIT"]);
export type AreaType = (typeof AreaType.enumValues)[number];

/** How the property is being transacted */
export const TransactionType = pgEnum("transaction_type", ["LEASE", "SALE", "LEASE_PURCHASE"]);
export type TransactionType = (typeof TransactionType.enumValues)[number];

/** Unit in which askingPrice is expressed */
export const PriceUnit = pgEnum("price_unit", ["PER_SQFT", "LUMP_SUM", "PER_MONTH"]);
export type PriceUnit = (typeof PriceUnit.enumValues)[number];

// ─── Certificate ──────────────────────────────────────────────────────────────

/** OC = Occupancy Certificate (safe to occupy); CC = Completion Certificate (construction complete) */
export const CertificateType = pgEnum("certificate_type", ["OC", "CC"]);
export type CertificateType = (typeof CertificateType.enumValues)[number];

/**
 * PENDING      → Certificate not yet received; property not operational (show ETA date picker)
 * RECEIVED     → Certificate received; certificateReceivedAt is stamped — triggers flash notification
 * NOT_REQUIRED → Property is exempt / already certified; no tracking needed
 */
export const CertificateStatus = pgEnum("certificate_status", [
  "PENDING",
  "RECEIVED",
  "NOT_REQUIRED",
]);
export type CertificateStatus = (typeof CertificateStatus.enumValues)[number];

/** SINGLE_OWNER = only superOwner; MULTIPLE_OWNER = superOwner + co-owners via property_owner table */
export const PropertyOwnershipType = pgEnum("property_ownership_type", [
  "SINGLE_OWNER",
  "MULTIPLE_OWNER",
]);
export type PropertyOwnershipType = (typeof PropertyOwnershipType.enumValues)[number];

// ─── Retail ───────────────────────────────────────────────────────────────────

export const RetailPropertyType = pgEnum("retail_mall_type", ["MALL", "HIGH_STREET"]);
export type RetailPropertyType = (typeof RetailPropertyType.enumValues)[number];

export const RetailStoreType = pgEnum("retail_store_type", ["ANCHOR", "VANILLA"]);
export type RetailStoreType = (typeof RetailStoreType.enumValues)[number];

export const RetailBrandCategory = pgEnum("retail_brand_category", [
  "HYPERMARKET",
  "APPAREL",
  "F_AND_B",
  "MULTIPLEX",
  "ACCESSORIES",
  "DEPARTMENTAL_STORES",
  "OTHERS",
]);
export type RetailBrandCategory = (typeof RetailBrandCategory.enumValues)[number];

// ─── Office ───────────────────────────────────────────────────────────────────

/** CBD = Central Business District, SBD = Secondary, TBD = Territory/Outlying */
export const BusinessDistrictType = pgEnum("business_district_type", ["CBD", "SBD", "TBD"]);
export type BusinessDistrictType = (typeof BusinessDistrictType.enumValues)[number];

// ─── Warehouse / Industrial ───────────────────────────────────────────────────

export const WarehouseConstructionType = pgEnum("warehouse_construction_type", [
  "RCC_COMPLIANT",
  "NON_RCC",
]);
export type WarehouseConstructionType = (typeof WarehouseConstructionType.enumValues)[number];

// ─── Commercial Parking ───────────────────────────────────────────────────────

export const ParkingType = pgEnum("parking_type", ["BASEMENT", "COVERED", "OPENED"]);
export type ParkingType = (typeof ParkingType.enumValues)[number];

export const ParkingConfiguration = pgEnum("parking_configuration", [
  "BASE_PARKING",
  "INDIVIDUAL_COVERED_SPACE",
  "HYDRAULIC_RACK",
]);
export type ParkingConfiguration = (typeof ParkingConfiguration.enumValues)[number];

export const ParkingAccessType = pgEnum("parking_access_type", [
  "DIRECT_ENTRY",
  "THROUGH_RAMP",
  "MULTI_LEVEL_ACCESS",
]);
export type ParkingAccessType = (typeof ParkingAccessType.enumValues)[number];

/** Multi-select — stored as an array column in DB */
export const ParkingSecurityControl = pgEnum("parking_security_control", [
  "RFID_ENTRY",
  "MANUAL_TICKETING",
  "ANPR",
  "CCTV_ENABLED",
]);
export type ParkingSecurityControl = (typeof ParkingSecurityControl.enumValues)[number];

export const ParkingVentilationType = pgEnum("parking_ventilation_type", ["NATURAL", "MECHANICAL"]);
export type ParkingVentilationType = (typeof ParkingVentilationType.enumValues)[number];
