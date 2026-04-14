import { company_request, getDB } from "@proptryx/database";
import { buildColumnSort, createTableListFetcher } from "@proptryx/utils";
import { asc, desc, eq, sql } from "drizzle-orm";
import type { CompanyRequestListQuery } from "./schema";

const MIN_FUZZY_SEARCH_LENGTH = 4;

function normalizeCompanyRequestSearchValue(value?: string | null) {
  return value?.trim().toLowerCase() ?? "";
}

function buildCompanyRequestSearchRank(searchTerm: string) {
  const prefixTerm = `${searchTerm}%`;
  const fuzzyScores =
    searchTerm.length >= MIN_FUZZY_SEARCH_LENGTH
      ? [
          sql`similarity(lower(${company_request.ownerEmail}), ${searchTerm})`,
          sql`similarity(lower(${company_request.ownerPhoneNumber}), ${searchTerm}) * 0.95`,
          sql`similarity(lower(${company_request.companyGstNumber}), ${searchTerm}) * 0.95`,
          sql`coalesce(similarity(lower(${company_request.companyEmail}), ${searchTerm}), 0)`,
          sql`similarity(lower(${company_request.ownerName}), ${searchTerm}) * 0.85`,
        ]
      : [sql`0`];

  return sql<number>`greatest(
    case when lower(${company_request.ownerEmail}) = ${searchTerm} then 1.2 else 0 end,
    case when lower(${company_request.ownerPhoneNumber}) = ${searchTerm} then 1.15 else 0 end,
    case when lower(${company_request.companyGstNumber}) = ${searchTerm} then 1.15 else 0 end,
    case when coalesce(lower(${company_request.companyEmail}), '') = ${searchTerm} then 1.1 else 0 end,
    case when lower(${company_request.ownerName}) = ${searchTerm} then 1 else 0 end,
    case when lower(${company_request.ownerEmail}) like ${prefixTerm} then 0.98 else 0 end,
    case when lower(${company_request.ownerPhoneNumber}) like ${prefixTerm} then 0.96 else 0 end,
    case when lower(${company_request.companyGstNumber}) like ${prefixTerm} then 0.96 else 0 end,
    case when coalesce(lower(${company_request.companyEmail}), '') like ${prefixTerm} then 0.94 else 0 end,
    case when lower(${company_request.ownerName}) like ${prefixTerm} then 0.88 else 0 end,
    ${sql.join(fuzzyScores, sql`, `)}
  )`;
}

export const fetchCompanyRequestList = createTableListFetcher<
  typeof company_request,
  typeof company_request.$inferSelect,
  CompanyRequestListQuery
>({
  db: getDB,
  table: company_request,
  where: eq(company_request.isDeleted, false),
  search: {
    exact: [company_request.id],
    prefix: [
      company_request.ownerEmail,
      company_request.ownerPhoneNumber,
      company_request.companyGstNumber,
      company_request.companyEmail,
    ],
    contains: [company_request.ownerName],
    build: ({ searchTerm }) => {
      const normalizedSearchTerm = normalizeCompanyRequestSearchValue(searchTerm);

      if (!normalizedSearchTerm) {
        return undefined;
      }

      const fuzzyConditions =
        normalizedSearchTerm.length >= MIN_FUZZY_SEARCH_LENGTH
          ? [
              sql`lower(${company_request.ownerEmail}) % ${normalizedSearchTerm}`,
              sql`lower(${company_request.ownerPhoneNumber}) % ${normalizedSearchTerm}`,
              sql`lower(${company_request.companyGstNumber}) % ${normalizedSearchTerm}`,
              sql`coalesce(lower(${company_request.companyEmail}), '') % ${normalizedSearchTerm}`,
              sql`lower(${company_request.ownerName}) % ${normalizedSearchTerm}`,
            ]
          : [];

      return fuzzyConditions;
    },
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
    definitions: {
      id: buildColumnSort(company_request.id),
      ownerName: buildColumnSort(company_request.ownerName),
      ownerEmail: buildColumnSort(company_request.ownerEmail),
      ownerPhoneNumber: buildColumnSort(company_request.ownerPhoneNumber),
      companyGstNumber: buildColumnSort(company_request.companyGstNumber),
      companyEmail: buildColumnSort(company_request.companyEmail),
      createdAt: ({ direction, params }) => {
        const normalizedSearchTerm = normalizeCompanyRequestSearchValue(params.search);
        const createdAtOrder =
          direction === "asc" ? asc(company_request.createdAt) : desc(company_request.createdAt);

        if (!normalizedSearchTerm) {
          return createdAtOrder;
        }

        return [desc(buildCompanyRequestSearchRank(normalizedSearchTerm)), createdAtOrder];
      },
      updatedAt: buildColumnSort(company_request.updatedAt),
    },
  },
  sortColumns: {
    id: company_request.id,
    ownerName: company_request.ownerName,
    ownerEmail: company_request.ownerEmail,
    ownerPhoneNumber: company_request.ownerPhoneNumber,
    companyGstNumber: company_request.companyGstNumber,
    companyEmail: company_request.companyEmail,
    createdAt: company_request.createdAt,
    updatedAt: company_request.updatedAt,
  },
});
