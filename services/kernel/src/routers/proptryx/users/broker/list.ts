/** biome-ignore-all lint/suspicious/noExplicitAny: Drizzle query builders are intentionally passed through reusable helpers. */
import { broker_request, getDB, region, user, zone } from "@proptryx/database";
import { createTableListFetcher, resolveDateRangeBoundary } from "@proptryx/utils";
import { and, eq, gte, lte, ne, sql } from "drizzle-orm";
import type { ScopedProptryxBrokerUserListQuery } from "./schema";

function proptryxBrokerUserListJoins(queryBuilder: any) {
  return queryBuilder
    .leftJoin(zone, eq(zone.id, user.zoneId))
    .leftJoin(region, eq(region.id, zone.regionId));
}

export const fetchProptryxBrokerUserList = createTableListFetcher<
  typeof user,
  typeof user.$inferSelect & { zone: string | null; region: string | null; pincode: string | null },
  ScopedProptryxBrokerUserListQuery
>({
  db: getDB,
  table: user,
  select: (columns) => ({
    ...columns,
    zone: zone.name,
    region: region.name,
    pincode: sql<string | null>`(
      SELECT ${broker_request.pincode}
      FROM ${broker_request}
      WHERE lower(trim(${broker_request.email})) = lower(trim(${user.email}))
      LIMIT 1
    )`,
  }),
  joins: proptryxBrokerUserListJoins,
  where: ({ params }) =>
    and(
      eq(user.panel, "proptryx"),
      eq(user.role, "broker"),
      eq(user.isDeleted, false),
      params.excludeUserId ? ne(user.id, params.excludeUserId) : undefined
    ),
  search: {
    exact: [user.id, user.role],
    prefix: [user.email, user.phoneNumber],
    contains: [user.name, zone.name, region.name],
    build: ({ searchTerm }) =>
      sql`EXISTS (
        SELECT 1 FROM ${broker_request}
        WHERE lower(trim(${broker_request.email})) = lower(trim(${user.email}))
          AND ${broker_request.pincode} ILIKE ${`%${searchTerm}%`}
      )`,
  },
  filterColumns: {
    zoneId: user.zoneId,
    regionId: zone.regionId,
  },
  filters: {
    startDate: {
      build: ({ params, value }) => {
        const date = resolveDateRangeBoundary({
          boundary: "start",
          timeZone: params.timeZone,
          value,
        });
        return date ? gte(user.createdAt, date) : undefined;
      },
    },
    endDate: {
      build: ({ params, value }) => {
        const date = resolveDateRangeBoundary({
          boundary: "end",
          timeZone: params.timeZone,
          value,
        });
        return date ? lte(user.createdAt, date) : undefined;
      },
    },
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
