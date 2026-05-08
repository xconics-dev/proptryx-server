import { getDB, property } from "@proptryx/database";
import { createTableListFetcher } from "@proptryx/utils";
import { and, eq } from "drizzle-orm";
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
