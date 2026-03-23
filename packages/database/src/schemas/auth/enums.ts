import { pgEnum } from "drizzle-orm/pg-core";

export const OrganizationType = pgEnum("organization_type", [
  "SELLER",
  "DEVELOPER",
  "MANAGEMENT",
  "APPLICATION",
]);
export const BusinessType = pgEnum("business_type", ["B2B", "B2C", "BOTH", "GENERAL"]);
export const AccessPanel = pgEnum("access_panel", ["proptryx", "company"]);
export const PermissionAccessLevel = pgEnum("permission_access_level", ["company", "user", "all"]);
