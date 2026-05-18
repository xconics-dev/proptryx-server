import { DATABASE_RESOURCES } from "@proptryx/database";
import {
  ApiBadRequestOpenApi,
  ApiNotFoundOpenApi,
  createApiJsonBody,
  createApiSuccessResponse,
  createOpenApiRoute,
  createOperationalRateLimit,
  createResourceRbacGuards,
  DEFAULT_FAST_RBAC_AUTH_OPTIONS,
  IdStringParamSchema,
} from "@proptryx/utils";
import {
  meetingCancelSchema,
  meetingCompleteSchema,
  meetingConfirmSchema,
  meetingCreateSchema,
  meetingDetailSchema,
  meetingGetQuerySchema,
  meetingLifecycleResponseSchema,
  meetingListQuerySchema,
  meetingListResponseSchema,
  meetingPublishMomSchema,
  meetingRejectSchema,
  meetingScheduleSchema,
  meetingUpdateSchema,
} from "./schema";

const tags = ["Company Meetings"];

const meetingRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.meeting,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const meetingMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "meeting-methods",
});

// Query Routes
export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "kernelCompanyMeetingList",
  tags,
  middleware: [meetingMethodsRateLimit, meetingRbac.custom("getAll")],
  summary: "List meetings",
  request: {
    query: meetingListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(meetingListResponseSchema, "Meetings fetched successfully"),
  },
});

export const get = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  operationId: "kernelCompanyMeetingGetById",
  tags,
  middleware: [meetingMethodsRateLimit, meetingRbac.get],
  summary: "Get a meeting by ID",
  request: {
    params: IdStringParamSchema(),
    query: meetingGetQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(meetingDetailSchema, "Meeting fetched successfully"),
    404: ApiNotFoundOpenApi,
  },
});

// Mutation Routes
export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "kernelCompanyMeetingCreate",
  tags,
  middleware: [meetingMethodsRateLimit, meetingRbac.custom("create")],
  summary: "Create Meeting Request",
  description:
    "Creates a new meeting request raised by a user before any developer or occupier scheduling decision has been made.",
  request: {
    body: createApiJsonBody(meetingCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(meetingDetailSchema, "Meeting request created successfully"),
    400: ApiBadRequestOpenApi,
  },
});

export const update = createOpenApiRoute({
  method: "patch",
  path: "/{id}",
  operationId: "kernelCompanyMeetingUpdateById",
  tags,
  middleware: [meetingMethodsRateLimit, meetingRbac.custom("update")],
  summary: "Update Meeting Request Details",
  description:
    "Updates request-level meeting details without setting the scheduled date and time. Use the scheduling endpoint when the developer or occupier confirms availability.",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(meetingUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(meetingDetailSchema, "Meeting updated successfully"),
    400: ApiBadRequestOpenApi,
    404: ApiNotFoundOpenApi,
  },
});

export const remove = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  operationId: "kernelCompanyMeetingDeleteById",
  tags,
  middleware: [meetingMethodsRateLimit, meetingRbac.custom("delete")],
  summary: "Soft delete a meeting by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(meetingDetailSchema, "Meeting deleted successfully"),
    400: ApiBadRequestOpenApi,
    404: ApiNotFoundOpenApi,
  },
});

// Lifecycle Management Routes
export const schedule = createOpenApiRoute({
  method: "post",
  path: "/{id}/schedule",
  operationId: "kernelCompanyMeetingSchedule",
  tags,
  middleware: [meetingMethodsRateLimit, meetingRbac.custom("update")],
  summary: "Accept / Schedule Meeting Request",
  description:
    "Sets or updates the scheduled date and time for a meeting request and can assign the developer and occupier involved in the meeting.",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(meetingScheduleSchema),
  },
  responses: {
    200: createApiSuccessResponse(
      meetingLifecycleResponseSchema,
      "Meeting request accepted and scheduled successfully"
    ),
    400: ApiBadRequestOpenApi,
    404: ApiNotFoundOpenApi,
  },
});

export const confirm = createOpenApiRoute({
  method: "post",
  path: "/{id}/confirm",
  operationId: "kernelCompanyMeetingConfirm",
  tags,
  middleware: [meetingMethodsRateLimit, meetingRbac.custom("update")],
  summary: "Confirm Scheduled Meeting",
  description: "Marks a scheduled developer and occupier meeting as confirmed.",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(meetingConfirmSchema),
  },
  responses: {
    200: createApiSuccessResponse(meetingLifecycleResponseSchema, "Meeting confirmed successfully"),
    400: ApiBadRequestOpenApi,
    404: ApiNotFoundOpenApi,
  },
});

export const start = createOpenApiRoute({
  method: "post",
  path: "/{id}/start",
  operationId: "kernelCompanyMeetingStart",
  tags,
  middleware: [meetingMethodsRateLimit, meetingRbac.custom("update")],
  summary: "Mark a meeting as in progress",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      meetingLifecycleResponseSchema,
      "Meeting marked as in progress successfully"
    ),
    400: ApiBadRequestOpenApi,
    404: ApiNotFoundOpenApi,
  },
});

export const complete = createOpenApiRoute({
  method: "post",
  path: "/{id}/complete",
  operationId: "kernelCompanyMeetingComplete",
  tags,
  middleware: [meetingMethodsRateLimit, meetingRbac.custom("update")],
  summary: "Complete a meeting",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(meetingCompleteSchema),
  },
  responses: {
    200: createApiSuccessResponse(meetingLifecycleResponseSchema, "Meeting completed successfully"),
    400: ApiBadRequestOpenApi,
    404: ApiNotFoundOpenApi,
  },
});

export const cancel = createOpenApiRoute({
  method: "post",
  path: "/{id}/cancel",
  operationId: "kernelCompanyMeetingCancel",
  tags,
  middleware: [meetingMethodsRateLimit, meetingRbac.custom("update")],
  summary: "Cancel a meeting",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(meetingCancelSchema),
  },
  responses: {
    200: createApiSuccessResponse(meetingLifecycleResponseSchema, "Meeting cancelled successfully"),
    400: ApiBadRequestOpenApi,
    404: ApiNotFoundOpenApi,
  },
});

export const reject = createOpenApiRoute({
  method: "post",
  path: "/{id}/reject",
  operationId: "kernelCompanyMeetingReject",
  tags,
  middleware: [meetingMethodsRateLimit, meetingRbac.custom("update")],
  summary: "Reject Meeting Request",
  description:
    "Rejects a pending meeting request before it is scheduled for the developer and occupier.",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(meetingRejectSchema),
  },
  responses: {
    200: createApiSuccessResponse(meetingLifecycleResponseSchema, "Meeting rejected successfully"),
    400: ApiBadRequestOpenApi,
    404: ApiNotFoundOpenApi,
  },
});

export const publishMom = createOpenApiRoute({
  method: "post",
  path: "/{id}/publish-mom",
  operationId: "kernelCompanyMeetingPublishMom",
  tags,
  middleware: [meetingMethodsRateLimit, meetingRbac.custom("publish")],
  summary: "Publish minutes of meeting",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(meetingPublishMomSchema),
  },
  responses: {
    200: createApiSuccessResponse(
      meetingLifecycleResponseSchema,
      "Meeting MOM published successfully"
    ),
    400: ApiBadRequestOpenApi,
    404: ApiNotFoundOpenApi,
  },
});
