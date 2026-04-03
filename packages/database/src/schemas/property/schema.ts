import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "../auth/schema";
import { createAuditRelationNames } from "../utils/audit";
import {
  AreaType,
  BusinessDistrictType,
  CertificateStatus,
  CertificateType,
  ParkingAccessType,
  ParkingConfiguration,
  ParkingSecurityControl,
  ParkingType,
  ParkingVentilationType,
  PriceUnit,
  PropertyOwnershipType,
  PropertyStatus,
  PropertyType,
  TransactionType,
  RetailBrandCategory,
  RetailPropertyType,
  RetailStoreType,
  WarehouseConstructionType,
} from "./enums";
import {
  defaultPropertyDocuments,
  defaultPropertyLocationMetadata,
  type PropertyDocument,
  type PropertyLocationMetadata,
} from "./types";

const auditRelations = {
  property: createAuditRelationNames("property"),
} as const;

export const property = pgTable(
  "property",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    description: text("description"),

    // Address & Location
    country: text("country").notNull(),
    state: text("state").notNull(),
    city: text("city").notNull(),
    addressLine1: text("address_line1").notNull(),
    addressLine2: text("address_line2"),
    pincode: text("pincode").notNull(),
    latitude: real("latitude"),
    longitude: real("longitude"),

    // Location metadata for search & filters
    locationMetadata: jsonb("location_metadata")
      .$type<PropertyLocationMetadata>()
      .default(defaultPropertyLocationMetadata)
      .notNull(),

    // Files & Images
    thumbnail: text("thumbnail"),
    images: text("images").array().default([]).notNull(),
    documents: jsonb("documents")
      .$type<PropertyDocument[]>()
      .default(defaultPropertyDocuments)
      .notNull(),

    // Boolean Statuses
    isVerified: boolean("is_verified").default(false).notNull(),
    isPublished: boolean("is_published").default(false).notNull(),

    // Operational & Certificate (OC / CC)
    isOperational: boolean("is_operational").default(false).notNull(),
    certificateType: CertificateType("certificate_type").default("OC").notNull(),
    certificateStatus: CertificateStatus("certificate_status").default("PENDING").notNull(),
    /** Expected certificate receipt date — only relevant when isOperational = false */
    certificateEtaDate: timestamp("certificate_eta_date"),
    /** Stamped when certificateStatus transitions to RECEIVED — frontend watches this to fire the toast */
    certificateReceivedAt: timestamp("certificate_received_at"),

    // Area Details
    totalAreaSqft: real("total_area_sqft"),
    roadWidthFt: real("road_width_ft"),
    /** SINGLE = one unit; SPLIT = divided floor/area-wise across multiple owners */
    areaType: AreaType("area_type").default("SINGLE").notNull(),

    // Pricing
    transactionType: TransactionType("transaction_type"),
    priceUnit: PriceUnit("price_unit"),
    priceNegotiable: boolean("price_negotiable").default(true).notNull(),

    // Enums
    type: PropertyType("type").notNull(),
    status: PropertyStatus("status").notNull(),

    // Ownership
    ownershipType: PropertyOwnershipType("ownership_type").default("SINGLE_OWNER").notNull(),
    superOwnerId: text("super_owner_id").references(() => user.id, {
      onDelete: "set null",
    }),
    // Co-owners are stored in the property_owner junction table

    // For keep reference
    createdByUser: text("created_by_user").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedByUser: text("updated_by_user").references(() => user.id, {
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
    deletedByUser: text("deleted_by_user").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("property_name_idx").on(table.name),
    index("property_superOwnerId_idx").on(table.superOwnerId),
    index("property_type_idx").on(table.type),
    index("property_status_idx").on(table.status),
    index("property_city_idx").on(table.city),
    index("property_pincode_idx").on(table.pincode),
    index("property_certificateStatus_idx").on(table.certificateStatus),
    index("property_isDeleted_isPublished_createdAt_idx").on(
      table.isDeleted,
      table.isPublished,
      table.createdAt
    ),
  ]
);

// ─── Retail Extension ─────────────────────────────────────────────────────────

export const propertyRetail = pgTable(
  "property_retail",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
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

// ─── Office Extension ─────────────────────────────────────────────────────────

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

// ─── Warehouse / Industrial Extension ─────────────────────────────────────────

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

// ─── Commercial Parking Extension ─────────────────────────────────────────────

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

// ─── Co-owner Junction Table ──────────────────────────────────────────────────
// Used when ownershipType = "MULTIPLE_OWNER". superOwner is still the primary
// controlling owner; entries here are co-owners / referenced owners.

export const propertyOwner = pgTable(
  "property_owner",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
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

    // Per-owner pricing — overrides the property-level price for this floor/area segment.
    // Null = inherit from the parent property pricing setup.
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

// ─── Relations ────────────────────────────────────────────────────────────────

export const propertyRelations = relations(property, ({ one, many }) => {
  const auditUser = (
    field:
      | typeof property.createdByUser
      | typeof property.updatedByUser
      | typeof property.deletedByUser,
    relationName: (typeof auditRelations.property)[keyof typeof auditRelations.property]
  ) =>
    one(user, {
      fields: [field],
      references: [user.id],
      relationName,
    });

  return {
    superOwner: one(user, {
      fields: [property.superOwnerId],
      references: [user.id],
      relationName: "propertySuperOwner",
    }),
    createdByUser: auditUser(property.createdByUser, auditRelations.property.created),
    updatedByUser: auditUser(property.updatedByUser, auditRelations.property.updated),
    deletedByUser: auditUser(property.deletedByUser, auditRelations.property.deleted),

    // Co-owners (populated when ownershipType = "MULTIPLE_OWNER")
    owners: many(propertyOwner),

    // Type-specific extension (only one will be populated per property)
    retailDetails: one(propertyRetail, {
      fields: [property.id],
      references: [propertyRetail.propertyId],
    }),
    officeDetails: one(propertyOffice, {
      fields: [property.id],
      references: [propertyOffice.propertyId],
    }),
    warehouseDetails: one(propertyWarehouse, {
      fields: [property.id],
      references: [propertyWarehouse.propertyId],
    }),
    parkingDetails: one(propertyParking, {
      fields: [property.id],
      references: [propertyParking.propertyId],
    }),
  };
});

export const propertyRetailRelations = relations(propertyRetail, ({ one }) => ({
  property: one(property, {
    fields: [propertyRetail.propertyId],
    references: [property.id],
  }),
}));

export const propertyOfficeRelations = relations(propertyOffice, ({ one }) => ({
  property: one(property, {
    fields: [propertyOffice.propertyId],
    references: [property.id],
  }),
}));

export const propertyWarehouseRelations = relations(propertyWarehouse, ({ one }) => ({
  property: one(property, {
    fields: [propertyWarehouse.propertyId],
    references: [property.id],
  }),
}));

export const propertyParkingRelations = relations(propertyParking, ({ one }) => ({
  property: one(property, {
    fields: [propertyParking.propertyId],
    references: [property.id],
  }),
}));

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
