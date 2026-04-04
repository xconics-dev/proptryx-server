import { db, meeting, property, user } from "@proptryx/database";
import { and, eq, inArray } from "drizzle-orm";

type IncludeDeletedOptions = {
  includeDeleted?: boolean;
};

type MeetingReferenceInput = {
  propertyId?: string | null;
  developerId?: string | null;
  occupierId?: string | null;
  requestedByUser?: string | null;
};

type UserSummary = {
  id: string;
  name: string;
  email: string;
  phoneNumber: string | null;
  panel: string | null;
  role: string | null;
};

type PropertySummary = {
  id: string;
  name: string;
  city: string;
  state: string;
  addressLine1: string;
  pincode: string;
  type: string;
  status: string;
  isPublished: boolean;
  isOperational: boolean;
};

export type MeetingRecord = typeof meeting.$inferSelect;

export async function findMeetingById(id: string, options?: IncludeDeletedOptions) {
  const whereClause = options?.includeDeleted
    ? eq(meeting.id, id)
    : and(eq(meeting.id, id), eq(meeting.isDeleted, false));

  return db
    .select()
    .from(meeting)
    .where(whereClause)
    .limit(1)
    .then((rows) => rows[0]);
}

export async function attachMeetingRelations<TMeeting extends MeetingRecord>(
  meetingsData: TMeeting[]
) {
  if (meetingsData.length === 0) {
    return [] as Array<
      TMeeting & {
        property: PropertySummary | null;
        developer: UserSummary | null;
        occupier: UserSummary | null;
        requestedByUser: UserSummary | null;
      }
    >;
  }

  const propertyIds = [...new Set(meetingsData.map((item) => item.propertyId).filter(Boolean))];
  const userIds = [
    ...new Set(
      meetingsData
        .flatMap((item) => [item.developerId, item.occupierId, item.requestedByUser])
        .filter((value): value is string => Boolean(value))
    ),
  ];

  const [properties, users] = await Promise.all([
    propertyIds.length === 0
      ? Promise.resolve([] as PropertySummary[])
      : db
          .select({
            id: property.id,
            name: property.name,
            city: property.city,
            state: property.state,
            addressLine1: property.addressLine1,
            pincode: property.pincode,
            type: property.type,
            status: property.status,
            isPublished: property.isPublished,
            isOperational: property.isOperational,
          })
          .from(property)
          .where(and(inArray(property.id, propertyIds), eq(property.isDeleted, false))),
    userIds.length === 0
      ? Promise.resolve([] as UserSummary[])
      : db
          .select({
            id: user.id,
            name: user.name,
            email: user.email,
            phoneNumber: user.phoneNumber,
            panel: user.panel,
            role: user.role,
          })
          .from(user)
          .where(and(inArray(user.id, userIds), eq(user.isDeleted, false))),
  ]);

  const propertyById = new Map(properties.map((item) => [item.id, item]));
  const userById = new Map(users.map((item) => [item.id, item]));

  return meetingsData.map((meetingData) => ({
    ...meetingData,
    property: propertyById.get(meetingData.propertyId) ?? null,
    developer: meetingData.developerId ? (userById.get(meetingData.developerId) ?? null) : null,
    occupier: meetingData.occupierId ? (userById.get(meetingData.occupierId) ?? null) : null,
    requestedByUser: meetingData.requestedByUser
      ? (userById.get(meetingData.requestedByUser) ?? null)
      : null,
  }));
}

export async function findMeetingByIdWithRelations(id: string, options?: IncludeDeletedOptions) {
  const meetingData = await findMeetingById(id, options);

  if (!meetingData) {
    return null;
  }

  const [meetingWithRelations] = await attachMeetingRelations([meetingData]);
  return meetingWithRelations ?? null;
}

export async function validateMeetingReferences(input: MeetingReferenceInput) {
  const checks = await Promise.all([
    input.propertyId
      ? db
          .select({ id: property.id })
          .from(property)
          .where(and(eq(property.id, input.propertyId), eq(property.isDeleted, false)))
          .limit(1)
          .then((rows) => rows[0])
      : Promise.resolve(true),
    input.developerId
      ? db
          .select({ id: user.id })
          .from(user)
          .where(and(eq(user.id, input.developerId), eq(user.isDeleted, false)))
          .limit(1)
          .then((rows) => rows[0])
      : Promise.resolve(true),
    input.occupierId
      ? db
          .select({ id: user.id })
          .from(user)
          .where(and(eq(user.id, input.occupierId), eq(user.isDeleted, false)))
          .limit(1)
          .then((rows) => rows[0])
      : Promise.resolve(true),
    input.requestedByUser
      ? db
          .select({ id: user.id })
          .from(user)
          .where(and(eq(user.id, input.requestedByUser), eq(user.isDeleted, false)))
          .limit(1)
          .then((rows) => rows[0])
      : Promise.resolve(true),
  ]);

  const errors: string[] = [];

  if (input.propertyId && !checks[0]) {
    errors.push(`Property ${input.propertyId} does not exist or is deleted`);
  }

  if (input.developerId && !checks[1]) {
    errors.push(`Developer ${input.developerId} does not exist or is deleted`);
  }

  if (input.occupierId && !checks[2]) {
    errors.push(`Occupier ${input.occupierId} does not exist or is deleted`);
  }

  if (input.requestedByUser && !checks[3]) {
    errors.push(`Requester ${input.requestedByUser} does not exist or is deleted`);
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function stripUndefinedFields<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(
    Object.entries(value).filter(([, fieldValue]) => fieldValue !== undefined)
  ) as Partial<T>;
}

export function getMeetingLifecycleError(
  meetingData: MeetingRecord,
  action: "schedule" | "confirm" | "start" | "complete" | "cancel" | "reject" | "publishMom"
) {
  if (meetingData.isDeleted) {
    return "Meeting is deleted";
  }

  switch (action) {
    case "schedule":
      if (meetingData.status !== "REQUESTED" && meetingData.status !== "SCHEDULED") {
        return "Only requested or scheduled meetings can be scheduled";
      }
      return null;
    case "confirm":
      if (meetingData.status !== "SCHEDULED") {
        return "Only scheduled meetings can be confirmed";
      }
      if (!meetingData.scheduledAt) {
        return "Meeting must be scheduled before it can be confirmed";
      }
      return null;
    case "start":
      if (meetingData.status !== "SCHEDULED") {
        return "Only scheduled meetings can be started";
      }
      if (!meetingData.scheduledAt) {
        return "Meeting must be scheduled before it can be started";
      }
      return null;
    case "complete":
      if (meetingData.status !== "SCHEDULED" && meetingData.status !== "IN_PROGRESS") {
        return "Only scheduled or in-progress meetings can be completed";
      }
      return null;
    case "cancel":
      if (
        meetingData.status === "COMPLETED" ||
        meetingData.status === "CANCELLED" ||
        meetingData.status === "REJECTED"
      ) {
        return `Cannot cancel a meeting that is ${meetingData.status.toLowerCase()}`;
      }
      return null;
    case "reject":
      if (meetingData.status !== "REQUESTED") {
        return "Only requested meetings can be rejected";
      }
      return null;
    case "publishMom":
      if (meetingData.status !== "COMPLETED") {
        return "Minutes of meeting can only be published after completion";
      }
      return null;
  }
}
