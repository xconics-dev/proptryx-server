import { relations } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "../auth/schema";
import { meeting } from "../meeting/schema";
import { faq } from "../site-data/faqs/schema";
import { createAuditRelationNames } from "../utils/audit";
import {
  AreaType,
  CertificateStatus,
  CertificateType,
  PriceUnit,
  PropertyOwnershipType,
  PropertyStatus,
  PropertyType,
  TransactionType,
} from "./enums";
import { propertyMedia } from "./property-media";
import { propertyOffice } from "./property-office";
import { propertyOwner } from "./property-owner";
import { propertyParking } from "./property-parking";
import { propertyRetail } from "./property-retail";
import { propertyWarehouse } from "./property-warehouse";
import { propertyZone } from "./property-zone";
import { defaultPropertyLocationMetadata, type PropertyLocationMetadata } from "./types";

const auditRelations = {
  property: createAuditRelationNames("property"),
} as const;

export const property = pgTable(
  "property",
  {
    id: text("id").primaryKey(),
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

    // Boolean Statuses
    isVerified: boolean("is_verified").default(false).notNull(),
    isPublished: boolean("is_published").default(false).notNull(),

    // Operational & Certificate (OC / CC)
    /** Derived operational flag: PENDING => false, RECEIVED / NOT_REQUIRED => true. */
    isOperational: boolean("is_operational").default(false).notNull(),
    certificateType: CertificateType("certificate_type").default("OC").notNull(),
    certificateStatus: CertificateStatus("certificate_status").default("PENDING").notNull(),
    /** Expected certificate receipt date — only relevant when isOperational = false */
    certificateEtaDate: timestamp("certificate_eta_date"),
    /** Stamped when certificateStatus transitions to RECEIVED — frontend watches this to fire the toast. */
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
    index("property_createdByUser_idx").on(table.createdByUser),
    index("property_type_idx").on(table.type),
    index("property_status_idx").on(table.status),
    index("property_city_idx").on(table.city),
    index("property_pincode_idx").on(table.pincode),
    index("property_certificateStatus_idx").on(table.certificateStatus),
    index("property_isDeleted_superOwnerId_idx").on(table.isDeleted, table.superOwnerId),
    index("property_isDeleted_createdByUser_idx").on(table.isDeleted, table.createdByUser),
    index("property_isDeleted_isPublished_createdAt_idx").on(
      table.isDeleted,
      table.isPublished,
      table.createdAt
    ),
  ]
);

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
    owners: many(propertyOwner),
    mediaItems: many(propertyMedia),
    meetings: many(meeting),
    faqs: many(faq),
    propertyZones: many(propertyZone, {
      relationName: "propertyZoneMappings",
    }),
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
