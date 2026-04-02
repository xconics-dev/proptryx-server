/** biome-ignore-all lint/suspicious/noExplicitAny: Drizzle query builders are intentionally passed through reusable helpers. */
import { getDB, member, user } from "@proptryx/database";
import { createTableListFetcher } from "@proptryx/utils";
import { and, eq } from "drizzle-orm";
import type { MemberListQuery } from "./schema";

function memberListJoins(queryBuilder: any) {
  return queryBuilder.innerJoin(user, eq(user.id, member.userId));
}

function mapMemberListItem(row: Record<string, unknown>) {
  const { name, email, image, phoneNumber, zoneId, ...memberData } = row;

  return {
    ...memberData,
    name,
    email,
    image,
    phoneNumber,
    zoneId,
  };
}

export const fetchMemberList = createTableListFetcher<
  typeof member,
  ReturnType<typeof mapMemberListItem>,
  MemberListQuery
>({
  db: getDB,
  table: member,
  select: (columns) => ({
    ...columns,
    user,
  }),
  joins: memberListJoins,
  where: and(eq(member.isDeleted, false), eq(user.isDeleted, false)),
  search: {
    exact: [member.id, member.organizationId],
    prefix: [user.email, user.phoneNumber],
    contains: [user.name],
  },
  filterColumns: {
    organizationId: member.organizationId,
    role: member.role,
    panel: member.panel,
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    name: user.name,
    email: user.email,
    createdAt: member.createdAt,
  },
  counts: {
    totalJoins: "data",
  },
  mapItem: mapMemberListItem,
});
