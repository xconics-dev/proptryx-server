/** biome-ignore-all lint/suspicious/noExplicitAny: Drizzle query builders are intentionally passed through reusable helpers. */
import { getDB, member, region, user, zone } from "@proptryx/database";
import { createTableListFetcher } from "@proptryx/utils";
import { and, eq, ne } from "drizzle-orm";
import type { ScopedMemberListQuery } from "./schema";

function memberListJoins(queryBuilder: any) {
  return queryBuilder
    .innerJoin(user, eq(user.id, member.userId))
    .leftJoin(zone, eq(zone.id, user.zoneId))
    .leftJoin(region, eq(region.id, zone.regionId));
}

function mapMemberListItem(row: Record<string, unknown>) {
  const { user: userData, zone: zoneName, region: regionName, ...memberData } = row;

  return {
    ...memberData,
    user:
      userData && typeof userData === "object"
        ? {
            ...userData,
            zone: zoneName ?? null,
            region: regionName ?? null,
          }
        : userData,
  };
}

export const fetchMemberList = createTableListFetcher<
  typeof member,
  ReturnType<typeof mapMemberListItem>,
  ScopedMemberListQuery
>({
  db: getDB,
  table: member,
  select: (columns) => ({
    ...columns,
    user,
    zone: zone.name,
    region: region.name,
  }),
  joins: memberListJoins,
  where: ({ params }) =>
    and(
      eq(member.isDeleted, false),
      eq(user.isDeleted, false),
      ne(member.role, "owner"),
      params.excludeUserId ? ne(member.userId, params.excludeUserId) : undefined
    ),
  search: {
    exact: [member.id, member.organizationId],
    prefix: [user.email, user.phoneNumber],
    contains: [user.name, zone.name, region.name],
  },
  filterColumns: {
    organizationId: member.organizationId,
    role: member.role,
    panel: member.panel,
    zoneId: user.zoneId,
    regionId: zone.regionId,
    emailVerified: user.emailVerified,
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    name: user.name,
    email: user.email,
    role: member.role,
    zone: zone.name,
    region: region.name,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  },
  counts: {
    totalJoins: "data",
  },
  mapItem: mapMemberListItem,
});
