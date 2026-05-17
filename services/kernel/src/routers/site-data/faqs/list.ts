import { faq, getDB, property, propertyOwner } from "@proptryx/database";
import { createTableListFetcher } from "@proptryx/utils";
import { eq, sql } from "drizzle-orm";
import type { FaqListQuery } from "./schema";

export const fetchFaqList = createTableListFetcher<
  typeof faq,
  typeof faq.$inferSelect,
  FaqListQuery
>({
  db: getDB,
  table: faq,
  where: ({ params }) => (params.includeDeleted ? undefined : eq(faq.isDeleted, false)),
  search: {
    exact: [faq.id],
    contains: [faq.question, faq.answer],
  },
  filterColumns: {
    isArchived: faq.isArchived,
    propertyId: faq.propertyId,
    createdByUser: faq.createdByUser,
  },
  filters: {
    propertyOrganizationId: {
      build: ({ value }) => sql`exists (
        select 1 from ${property}
        where ${property.id} = ${faq.propertyId}
        and ${property.isDeleted} = false
        and ${property.organizationId} = ${String(value)}
      )`,
    },
    propertyCreatedByUser: {
      build: ({ value }) => sql`exists (
        select 1 from ${property}
        where ${property.id} = ${faq.propertyId}
        and ${property.isDeleted} = false
        and ${property.createdByUser} = ${String(value)}
      )`,
    },
    propertyOwnerUserId: {
      build: ({ value }) => sql`exists (
        select 1 from ${property}
        where ${property.id} = ${faq.propertyId}
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
    id: faq.id,
    propertyId: faq.propertyId,
    question: faq.question,
    isArchived: faq.isArchived,
    createdAt: faq.createdAt,
    updatedAt: faq.updatedAt,
  },
});
