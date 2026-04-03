import { relations } from "drizzle-orm";
import { boolean, index, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { user } from "../auth/schema";
import { zone } from "../zone-region/schema";
import { createAuditRelationNames } from "../utils/audit";
import { property } from "./property";

const auditRelations = {
  propertyZone: createAuditRelationNames("propertyZone"),
} as const;

export const propertyZone = pgTable(
  "property_zone",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    propertyId: uuid("property_id")
      .notNull()
      .references(() => property.id, { onDelete: "cascade" }),
    // Region is derived through zone.regionId, so we only persist the zone link here.
    zoneId: text("zone_id")
      .notNull()
      .references(() => zone.id, { onDelete: "cascade" }),

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
    unique("property_zone_propertyId_zoneId_unique").on(table.propertyId, table.zoneId),
    index("property_zone_propertyId_idx").on(table.propertyId),
    index("property_zone_zoneId_idx").on(table.zoneId),
    index("property_zone_isDeleted_propertyId_idx").on(table.isDeleted, table.propertyId),
  ]
);

export const propertyZoneRelations = relations(propertyZone, ({ one }) => {
  const auditUser = (
    field:
      | typeof propertyZone.createdByUser
      | typeof propertyZone.updatedByUser
      | typeof propertyZone.deletedByUser,
    relationName: (typeof auditRelations.propertyZone)[keyof typeof auditRelations.propertyZone]
  ) =>
    one(user, {
      fields: [field],
      references: [user.id],
      relationName,
    });

  return {
    property: one(property, {
      fields: [propertyZone.propertyId],
      references: [property.id],
      relationName: "propertyZoneMappings",
    }),
    zone: one(zone, {
      fields: [propertyZone.zoneId],
      references: [zone.id],
      relationName: "zonePropertyZones",
    }),
    createdByUser: auditUser(propertyZone.createdByUser, auditRelations.propertyZone.created),
    updatedByUser: auditUser(propertyZone.updatedByUser, auditRelations.propertyZone.updated),
    deletedByUser: auditUser(propertyZone.deletedByUser, auditRelations.propertyZone.deleted),
  };
});
