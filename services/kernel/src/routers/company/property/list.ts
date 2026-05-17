import { getDB, property, propertyOwner } from "@proptryx/database";
import { createTableListFetcher } from "@proptryx/utils";
import { eq, sql } from "drizzle-orm";
import type { PropertyListQuery } from "./schema";

export const fetchPropertyList = createTableListFetcher<
  typeof property,
  typeof property.$inferSelect,
  PropertyListQuery
>({
  db: getDB,
  table: property,
  where: ({ params }) => (params.includeDeleted ? undefined : eq(property.isDeleted, false)),
  search: {
    exact: [property.id, property.organizationId, property.superOwnerId, property.pincode],
    contains: [
      property.name,
      property.description,
      property.city,
      property.state,
      property.country,
      property.addressLine1,
      property.addressLine2,
    ],
  },
  filterColumns: {
    organizationId: property.organizationId,
    createdByUser: property.createdByUser,
    superOwnerId: property.superOwnerId,
    type: property.type,
    status: property.status,
    city: property.city,
    state: property.state,
    isPublished: property.isPublished,
    isOperational: property.isOperational,
    isVerified: property.isVerified,
  },
  filters: {
    ownUserId: {
      build: ({ value }) => sql`(
        ${property.createdByUser} = ${String(value)}
        or ${property.superOwnerId} = ${String(value)}
        or exists (
          select 1 from ${propertyOwner}
          where ${propertyOwner.propertyId} = ${property.id}
          and ${propertyOwner.userId} = ${String(value)}
        )
      )`,
    },
    ownerUserId: {
      build: ({ value }) => sql`(
        ${property.superOwnerId} = ${String(value)}
        or exists (
          select 1 from ${propertyOwner}
          where ${propertyOwner.propertyId} = ${property.id}
          and ${propertyOwner.userId} = ${String(value)}
        )
      )`,
    },
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    id: property.id,
    organizationId: property.organizationId,
    name: property.name,
    type: property.type,
    status: property.status,
    city: property.city,
    state: property.state,
    isPublished: property.isPublished,
    isOperational: property.isOperational,
    createdAt: property.createdAt,
    updatedAt: property.updatedAt,
  },
});
