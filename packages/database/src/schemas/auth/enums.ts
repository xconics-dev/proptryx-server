import { pgEnum } from "drizzle-orm/pg-core";

export const OrganizationType = pgEnum("organization_types", ["SELLER", "BUYER"]);

export const CompanyType = pgEnum("company_types", [
  "PVT_LTD",
  "LLP",
  "PROPRIETORSHIP",
  "PARTNERSHIP",
  "CORPORATION",
  "LLC",
  "NON_PROFIT",
  "OTHER",
]);
