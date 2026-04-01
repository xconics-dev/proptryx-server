/** biome-ignore-all lint/suspicious/noExplicitAny: Drizzle query builders are intentionally passed through reusable helpers. */
import { getDB, member, organization, user } from "@proptryx/database";
import { createTableListFetcher } from "@proptryx/utils";
import { and, eq } from "drizzle-orm";
import type { CompanyListQuery } from "./schema";

function companyListJoins(queryBuilder: any) {
  return queryBuilder
    .leftJoin(member, and(eq(member.organizationId, organization.id), eq(member.role, "owner")))
    .leftJoin(user, eq(user.id, member.userId));
}

function mapCompanyListItem(row: Record<string, unknown>) {
  const { ownerId, ownerName, ownerEmail, ownerPhoneNumber, ...company } = row;

  return {
    ...company,
    owner:
      ownerId && ownerName && ownerEmail
        ? {
            id: ownerId,
            name: ownerName,
            email: ownerEmail,
            phoneNumber: ownerPhoneNumber ?? null,
          }
        : null,
  };
}

export const fetchCompanyList = createTableListFetcher<
  typeof organization,
  ReturnType<typeof mapCompanyListItem>,
  CompanyListQuery
>({
  db: getDB,
  table: organization,
  select: (columns) => ({
    ...columns,
    ownerId: user.id,
    ownerName: user.name,
    ownerEmail: user.email,
    ownerPhoneNumber: user.phoneNumber,
  }),
  joins: companyListJoins,
  where: eq(organization.isDeleted, false),
  search: {
    exact: [organization.id],
    prefix: [
      organization.slug,
      organization.email,
      organization.phoneNumber,
      organization.gstNumber,
      user.email,
    ],
    contains: [organization.name, user.name],
  },
  filterColumns: {
    isActive: organization.isActive,
    type: organization.type,
    companyType: organization.companyType,
    industry: organization.industry,
  },
  sorting: { defaultBy: "createdAt", defaultOrder: "desc" },
  sortColumns: {
    id: organization.id,
    name: organization.name,
    email: organization.email,
    phoneNumber: organization.phoneNumber,
    isActive: organization.isActive,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  },
  counts: {
    totalJoins: false,
    filteredJoins: (queryBuilder, { hasSearch }) =>
      hasSearch ? companyListJoins(queryBuilder) : queryBuilder,
  },
  mapItem: mapCompanyListItem,
});
