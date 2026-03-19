import { pgEnum } from "drizzle-orm/pg-core";

export const OrganizationType = pgEnum("organization_type", ["SELLER", "DEVELOPER", "MANAGEMENT"]);

export const CompanyType = pgEnum("company_type", [
  "PVT_LTD",
  "LLP",
  "PROPRIETORSHIP",
  "PARTNERSHIP",
  "CORPORATION",
  "LLC",
  "NON_PROFIT",
  "OTHER",
]);
