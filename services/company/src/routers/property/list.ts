import { getDB, property, propertyOwner } from "@proptryx/database";
import { createTableListFetcher } from "@proptryx/utils";
import { and, eq, sql } from "drizzle-orm";
import type { ScopedCompanyPropertyListQuery } from "./schema";

export const fetchPropertyList = createTableListFetcher<
  typeof property,
  typeof property.$inferSelect,
  ScopedCompanyPropertyListQuery
>({
  db: getDB,
  table: property,
  where: ({ params }) =>
    and(
      eq(property.organizationId, params.organizationId),
      params.includeDeleted ? undefined : eq(property.isDeleted, false)
    ),
  search: {
    exact: [property.id, property.superOwnerId, property.organizationId, property.pincode],
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
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    id: property.id,
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
