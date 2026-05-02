import { getDB, rbacRole } from "@proptryx/database";
import { createTableListFetcher } from "@proptryx/utils";
import { and, eq } from "drizzle-orm";
import type { ScopedRoleListQuery } from "./schema";

export const fetchRoleListBase = createTableListFetcher<
  typeof rbacRole,
  typeof rbacRole.$inferSelect,
  ScopedRoleListQuery
>({
  db: getDB,
  table: rbacRole,
  where: eq(rbacRole.panel, "company"),
  search: {
    exact: [rbacRole.id, rbacRole.slug, rbacRole.organizationId],
    contains: [rbacRole.name, rbacRole.description],
  },
  filterColumns: {
    isActive: rbacRole.isActive,
  },
  filters: {
    companyId: {
      build: ({ value }) => eq(rbacRole.organizationId, String(value)),
    },
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    name: rbacRole.name,
    slug: rbacRole.slug,
    createdAt: rbacRole.createdAt,
    updatedAt: rbacRole.updatedAt,
  },
});
