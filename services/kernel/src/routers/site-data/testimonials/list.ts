import { getDB, property, propertyOwner, testimonial } from "@proptryx/database";
import { createTableListFetcher } from "@proptryx/utils";
import { eq, sql } from "drizzle-orm";
import type { TestimonialListQuery } from "./schema";

export const fetchTestimonialList = createTableListFetcher<
  typeof testimonial,
  typeof testimonial.$inferSelect,
  TestimonialListQuery
>({
  db: getDB,
  table: testimonial,
  where: ({ params }) => (params.includeDeleted ? undefined : eq(testimonial.isDeleted, false)),
  search: {
    exact: [testimonial.id],
    contains: [testimonial.authorName, testimonial.designation, testimonial.description],
  },
  filterColumns: {
    isArchived: testimonial.isArchived,
    propertyId: testimonial.propertyId,
    createdByUser: testimonial.createdByUser,
  },
  filters: {
    propertyOrganizationId: {
      build: ({ value }) => sql`exists (
        select 1 from ${property}
        where ${property.id} = ${testimonial.propertyId}
        and ${property.isDeleted} = false
        and ${property.organizationId} = ${String(value)}
      )`,
    },
    propertyCreatedByUser: {
      build: ({ value }) => sql`exists (
        select 1 from ${property}
        where ${property.id} = ${testimonial.propertyId}
        and ${property.isDeleted} = false
        and ${property.createdByUser} = ${String(value)}
      )`,
    },
    propertyOwnerUserId: {
      build: ({ value }) => sql`exists (
        select 1 from ${property}
        where ${property.id} = ${testimonial.propertyId}
        and ${property.isDeleted} = false
        and (
          ${property.superOwnerId} = ${String(value)}
          or exists (
            select 1 from ${propertyOwner}
            where ${propertyOwner.propertyId} = ${property.id}
            and ${propertyOwner.userId} = ${String(value)}
          )
        )
      )`,
    },
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    id: testimonial.id,
    propertyId: testimonial.propertyId,
    authorName: testimonial.authorName,
    designation: testimonial.designation,
    ratings: testimonial.ratings,
    isArchived: testimonial.isArchived,
    createdAt: testimonial.createdAt,
    updatedAt: testimonial.updatedAt,
  },
});
