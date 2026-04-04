import { MeetingStatus, MeetingType, meeting } from "@proptryx/database";
import {
  createDbInsertSchema,
  createDbSelectSchema,
  createDbUpdateSchema,
  createListQuerySchema,
  createListResponseSchema,
  optionalBooleanQuerySchema,
} from "@proptryx/utils";
import { z } from "@hono/zod-openapi";

const optionalDateQuerySchema = z.preprocess((value) => {
  if (value === "" || value === undefined || value === null) {
    return undefined;
  }

  return value;
}, z.coerce.date().optional());

export const meetingUserSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  email: z.string().email(),
  phoneNumber: z.string().nullable(),
  panel: z.string().nullable(),
  role: z.string().nullable(),
});

export const meetingPropertySummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  state: z.string(),
  addressLine1: z.string(),
  pincode: z.string(),
  type: z.string(),
  status: z.string(),
  isPublished: z.boolean(),
  isOperational: z.boolean(),
});

export const meetingSchema = createDbSelectSchema(meeting);

export const meetingDetailSchema = meetingSchema.extend({
  property: meetingPropertySummarySchema.nullable(),
  developer: meetingUserSummarySchema.nullable(),
  occupier: meetingUserSummarySchema.nullable(),
  requestedByUser: meetingUserSummarySchema.nullable(),
});

export const meetingCreateSchema = createDbInsertSchema(meeting, {
  omit: [
    "id",
    "status",
    "mom",
    "requestedAt",
    "scheduledAt",
    "confirmedAt",
    "completedAt",
    "cancelledAt",
    "cancellationReason",
    "momPublishedAt",
    "createdAt",
    "updatedAt",
    "isDeleted",
    "deletedAt",
    "createdByUser",
    "updatedByUser",
    "deletedByUser",
  ],
});

export const meetingUpdateSchema = createDbUpdateSchema(meeting, {
  omit: [
    "id",
    "status",
    "mom",
    "requestedAt",
    "scheduledAt",
    "confirmedAt",
    "completedAt",
    "cancelledAt",
    "cancellationReason",
    "momPublishedAt",
    "createdAt",
    "updatedAt",
    "isDeleted",
    "deletedAt",
    "createdByUser",
    "updatedByUser",
    "deletedByUser",
  ],
});

export const meetingScheduleSchema = z.object({
  scheduledAt: z.coerce.date().describe("Scheduled meeting date and time proposed or accepted"),
  agenda: z
    .string()
    .nullable()
    .optional()
    .describe("Agenda to be shared with the developer and occupier"),
  location: z
    .string()
    .nullable()
    .optional()
    .describe("Meeting location confirmed for the developer and occupier"),
  latitude: z
    .string()
    .nullable()
    .optional()
    .describe("Latitude for the scheduled meeting location"),
  longitude: z
    .string()
    .nullable()
    .optional()
    .describe("Longitude for the scheduled meeting location"),
  developerId: z
    .string()
    .nullable()
    .optional()
    .describe("Developer user assigned for the scheduled meeting"),
  occupierId: z
    .string()
    .nullable()
    .optional()
    .describe("Occupier user assigned for the scheduled meeting"),
});

export const meetingConfirmSchema = z.object({
  confirmedAt: z.coerce
    .date()
    .optional()
    .describe("Date and time when the scheduled meeting was confirmed"),
});

export const meetingCompleteSchema = z.object({
  completedAt: z.coerce.date().optional().describe("Date and time when the meeting was completed"),
  mom: z.string().nullable().optional().describe("Minutes of meeting captured after completion"),
});

export const meetingCancelSchema = z.object({
  cancelledAt: z.coerce.date().optional().describe("Date and time when the meeting was cancelled"),
  reason: z.string().min(1, "Cancellation reason is required"),
});

export const meetingRejectSchema = z.object({
  reason: z.string().min(1, "Rejection reason is required"),
});

export const meetingPublishMomSchema = z.object({
  mom: z
    .string()
    .min(1, "Minutes of meeting is required")
    .describe("Final published minutes of meeting"),
  momPublishedAt: z.coerce
    .date()
    .optional()
    .describe("Date and time when the minutes of meeting were published"),
});

export const meetingLifecycleResponseSchema = meetingDetailSchema;

export const meetingListSortFields = [
  "id",
  "type",
  "status",
  "propertyId",
  "developerId",
  "occupierId",
  "requestedByUser",
  "requestedAt",
  "scheduledAt",
  "confirmedAt",
  "completedAt",
  "cancelledAt",
  "createdAt",
  "updatedAt",
] as const;

export const meetingListQuerySchema = createListQuerySchema({
  sortFields: meetingListSortFields,
  extraShape: {
    propertyId: z.string().optional(),
    developerId: z.string().optional(),
    occupierId: z.string().optional(),
    requestedByUser: z.string().optional(),
    type: z.enum(MeetingType.enumValues).optional(),
    status: z.enum(MeetingStatus.enumValues).optional(),
    includeDeleted: optionalBooleanQuerySchema,
    requestedFrom: optionalDateQuerySchema,
    requestedTo: optionalDateQuerySchema,
    scheduledFrom: optionalDateQuerySchema,
    scheduledTo: optionalDateQuerySchema,
  },
});

export type MeetingListQuery = z.infer<typeof meetingListQuerySchema>;

export const meetingGetQuerySchema = z.object({
  includeDeleted: optionalBooleanQuerySchema,
});

export const meetingListResponseSchema = createListResponseSchema(meetingDetailSchema);
