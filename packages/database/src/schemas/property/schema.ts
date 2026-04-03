import { relations } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { user } from "../auth/schema";
import { createAuditRelationNames } from "../utils/audit";
import { PropertyStatus, PropertyType } from "./enums";
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

    // Enums
    type: PropertyType("type").notNull(),
    status: PropertyStatus("status").notNull(),

    // Relation for Property Control
    superOwnerId: text("super_owner_id").references(() => user.id, {
      onDelete: "set null",
    }),

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
    index("property_isDeleted_isPublished_createdAt_idx").on(
      table.isDeleted,
      table.isPublished,
      table.createdAt
    ),
  ]
);

export const propertyRelations = relations(property, ({ one }) => {
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
  };
});
