import { company_request, getDB } from "@proptryx/database";
import { createTableListFetcher } from "@proptryx/utils";
import { eq } from "drizzle-orm";
import type { CompanyRequestListQuery } from "./schema";

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
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
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
