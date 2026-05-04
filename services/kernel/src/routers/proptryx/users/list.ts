/** biome-ignore-all lint/suspicious/noExplicitAny: Drizzle query builders are intentionally passed through reusable helpers. */
import { getDB, region, user, zone } from "@proptryx/database";
import { createTableListFetcher } from "@proptryx/utils";
import { and, eq, ne } from "drizzle-orm";
import type { ScopedProptryxUserListQuery } from "./schema";

function proptryxUserListJoins(queryBuilder: any) {
  return queryBuilder
    .leftJoin(zone, eq(zone.id, user.zoneId))
    .leftJoin(region, eq(region.id, zone.regionId));
}

export const fetchProptryxUserList = createTableListFetcher<
  typeof user,
  typeof user.$inferSelect & { zone: string | null; region: string | null },
  ScopedProptryxUserListQuery
>({
  db: getDB,
  table: user,
  select: (columns) => ({
    ...columns,
    zone: zone.name,
    region: region.name,
  }),
  joins: proptryxUserListJoins,
  where: ({ params }) =>
    and(
      eq(user.panel, "proptryx"),
      eq(user.isDeleted, false),
      ne(user.role, "broker"), // Exclude brokers from the user list
      params.excludeUserId ? ne(user.id, params.excludeUserId) : undefined
    ),
  search: {
    exact: [user.id, user.role],
    prefix: [user.email, user.phoneNumber],
    contains: [user.name, zone.name, region.name],
  },
  filterColumns: {
    role: user.role,
    zoneId: user.zoneId,
    regionId: zone.regionId,
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    name: user.name,
    email: user.email,
    role: user.role,
    zone: zone.name,
    region: region.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  },
  counts: {
    totalJoins: "data",
  },
});
