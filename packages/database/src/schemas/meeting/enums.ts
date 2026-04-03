import { pgEnum } from "drizzle-orm/pg-core";

export const MeetingType = pgEnum("meeting_type", ["MEETING", "SITE_VISIT"]);
export type MeetingType = (typeof MeetingType.enumValues)[number];

export const MeetingStatus = pgEnum("meeting_status", [
  "SCHEDULED",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
  "IN_PROGRESS",
]);
export type MeetingStatus = (typeof MeetingStatus.enumValues)[number];
