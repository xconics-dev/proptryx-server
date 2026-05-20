import { getDB, meeting, property } from "@proptryx/database";
import { createTableListFetcher } from "@proptryx/utils";
import { eq, gte, lte, sql } from "drizzle-orm";
import type { MeetingListQuery } from "./schema";

export const fetchMeetingList = createTableListFetcher<
  typeof meeting,
  typeof meeting.$inferSelect,
  MeetingListQuery
>({
  db: getDB,
  table: meeting,
  where: ({ params }) => (params.includeDeleted ? undefined : eq(meeting.isDeleted, false)),
  search: {
    exact: [
      meeting.id,
      meeting.propertyId,
      meeting.developerId,
      meeting.occupierId,
      meeting.requestedByUser,
    ],
    contains: [
      meeting.agenda,
      meeting.requestNote,
      meeting.location,
      meeting.mom,
      meeting.cancellationReason,
    ],
  },
  filterColumns: {
    propertyId: meeting.propertyId,
    developerId: meeting.developerId,
    occupierId: meeting.occupierId,
    requestedByUser: meeting.requestedByUser,
    type: meeting.type,
    status: meeting.status,
  },
  filters: {
    organizationId: {
      build: ({ value }) => sql`exists (
        select 1 from ${property}
        where ${property.id} = ${meeting.propertyId}
        and ${property.organizationId} = ${String(value)}
        and ${property.isDeleted} = false
      )`,
    },
    ownUserId: {
      build: ({ value }) => sql`(
        ${meeting.createdByUser} = ${String(value)}
        or ${meeting.requestedByUser} = ${String(value)}
        or ${meeting.developerId} = ${String(value)}
        or ${meeting.occupierId} = ${String(value)}
      )`,
    },
    requestedFrom: {
      shouldApply: (value) => value instanceof Date,
      build: ({ value }) => gte(meeting.requestedAt, value as Date),
    },
    requestedTo: {
      shouldApply: (value) => value instanceof Date,
      build: ({ value }) => lte(meeting.requestedAt, value as Date),
    },
    scheduledFrom: {
      shouldApply: (value) => value instanceof Date,
      build: ({ value }) => gte(meeting.scheduledAt, value as Date),
    },
    scheduledTo: {
      shouldApply: (value) => value instanceof Date,
      build: ({ value }) => lte(meeting.scheduledAt, value as Date),
    },
  },
  sorting: {
    defaultBy: "requestedAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    id: meeting.id,
    type: meeting.type,
    status: meeting.status,
    propertyId: meeting.propertyId,
    developerId: meeting.developerId,
    occupierId: meeting.occupierId,
    requestedByUser: meeting.requestedByUser,
    requestedAt: meeting.requestedAt,
    scheduledAt: meeting.scheduledAt,
    confirmedAt: meeting.confirmedAt,
    completedAt: meeting.completedAt,
    cancelledAt: meeting.cancelledAt,
    createdAt: meeting.createdAt,
    updatedAt: meeting.updatedAt,
  },
});
