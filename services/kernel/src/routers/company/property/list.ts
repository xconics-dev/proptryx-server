import { getDB, property } from "@proptryx/database";
import { createTableListFetcher } from "@proptryx/utils";
import { eq } from "drizzle-orm";
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
