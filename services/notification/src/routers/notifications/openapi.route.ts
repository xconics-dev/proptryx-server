import { DATABASE_RESOURCES } from "@proptryx/database";
import {
  createApiJsonBody,
  createApiSuccessResponse,
  createOpenApiRoute,
  createOperationalRateLimit,
  createRequiredAuthSessionMiddleware,
  createResourceRbacGuards,
  DEFAULT_FAST_RBAC_AUTH_OPTIONS,
  IdStringParamSchema,
} from "@proptryx/utils";
import {
  notificationListQuerySchema,
  notificationListResponseSchema,
  notificationMutationResultSchema,
  notificationPreferenceSchema,
  notificationPreferenceUpdateSchema,
  notificationPushSubscriptionSchema,
  notificationRegisterPushSubscriptionSchema,
  notificationSchema,
  notificationTestPushResultSchema,
  notificationTestPushSchema,
  notificationTemplateListQuerySchema,
  notificationTemplateListResultSchema,
  notificationTemplateSchema,
  notificationTemplateUpsertSchema,
  notificationTriggerListQuerySchema,
  notificationTriggerListResultSchema,
  notificationTriggerExecutionListQuerySchema,
  notificationTriggerExecutionListResultSchema,
  notificationTriggerOptionsSchema,
  notificationTriggerSchema,
  notificationTriggerBaseInputSchema,
  notificationTriggerTestResultSchema,
  notificationTriggerTestSchema,
  notificationTriggerUpsertSchema,
  notificationUnreadCountSchema,
  notificationUnregisterPushSubscriptionSchema,
  internalPropertyPublishedNotificationSchema,
  internalResourceEventNotificationSchema,
  proptryxNotificationBroadcastSchema,
  proptryxNotificationSendResultSchema,
  proptryxNotificationSendSchema,
} from "./schema";

export const notificationRateLimit = createOperationalRateLimit({
  keyPrefix: "notification-service",
});

export const authMiddleware = createRequiredAuthSessionMiddleware(DEFAULT_FAST_RBAC_AUTH_OPTIONS);

const notificationTemplateAuthOptions = {
  ...DEFAULT_FAST_RBAC_AUTH_OPTIONS,
  // Template lists are read-heavy and change infrequently, so cache auth longer here
  // to avoid auth-service bursts surfacing as 503s.
  cacheTtlMs: 60_000,
  redisCacheTtlSeconds: 60,
} as const;

const notificationRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.notification,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});
const notificationTemplateRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.notification_template,
  auth: notificationTemplateAuthOptions,
});
const notificationTriggerRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.notification_trigger,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const userTags = ["Notifications"];
const proptryxTags = ["Proptryx / Notifications"];
const internalTags = ["Internal Notifications"];

export const listMyNotifications = createOpenApiRoute({
  method: "get",
  path: "/me/list",
  operationId: "notificationMyList",
  tags: userTags,
  middleware: [notificationRateLimit, authMiddleware],
  summary: "List notifications for the current user",
  request: {
    query: notificationListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(
      notificationListResponseSchema,
      "Notifications fetched successfully"
    ),
  },
});

export const getMyUnreadNotificationCount = createOpenApiRoute({
  method: "get",
  path: "/me/unread-count",
  operationId: "notificationMyUnreadCount",
  tags: userTags,
  middleware: [notificationRateLimit, authMiddleware],
  summary: "Get unread notification count for the current user",
  responses: {
    200: createApiSuccessResponse(
      notificationUnreadCountSchema,
      "Unread count fetched successfully"
    ),
  },
});

export const streamMyNotifications = createOpenApiRoute({
  method: "get",
  path: "/me/stream",
  operationId: "notificationMyStream",
  tags: userTags,
  middleware: [notificationRateLimit, authMiddleware],
  summary: "Stream current user's dashboard notifications in realtime",
  responses: {
    200: {
      description: "Server-sent notification event stream",
    },
  },
});

export const markMyNotificationRead = createOpenApiRoute({
  method: "patch",
  path: "/{id}/read",
  operationId: "notificationMarkRead",
  tags: userTags,
  middleware: [notificationRateLimit, authMiddleware],
  summary: "Mark a notification as read for the current user",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(notificationSchema, "Notification marked as read"),
  },
});

export const archiveMyNotification = createOpenApiRoute({
  method: "patch",
  path: "/{id}/archive",
  operationId: "notificationArchive",
  tags: userTags,
  middleware: [notificationRateLimit, authMiddleware],
  summary: "Archive a notification for the current user",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(notificationSchema, "Notification archived"),
  },
});

export const deleteMyNotification = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  operationId: "notificationDelete",
  tags: userTags,
  middleware: [notificationRateLimit, authMiddleware],
  summary: "Delete a notification for the current user",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(notificationSchema, "Notification deleted"),
  },
});

export const markAllMyNotificationsRead = createOpenApiRoute({
  method: "patch",
  path: "/read-all",
  operationId: "notificationMarkAllRead",
  tags: userTags,
  middleware: [notificationRateLimit, authMiddleware],
  summary: "Mark all notifications as read for the current user",
  responses: {
    200: createApiSuccessResponse(notificationMutationResultSchema, "Notifications marked as read"),
  },
});

export const registerPushSubscription = createOpenApiRoute({
  method: "post",
  path: "/push-subscriptions",
  operationId: "notificationRegisterPushSubscription",
  tags: userTags,
  middleware: [notificationRateLimit, authMiddleware],
  summary: "Register or refresh the current user's FCM web push token",
  request: {
    body: createApiJsonBody(notificationRegisterPushSubscriptionSchema),
  },
  responses: {
    200: createApiSuccessResponse(
      notificationPushSubscriptionSchema,
      "Push subscription registered successfully"
    ),
  },
});

export const testMyPushNotification = createOpenApiRoute({
  method: "post",
  path: "/me/test-push",
  operationId: "notificationMyTestPush",
  tags: userTags,
  middleware: [notificationRateLimit, authMiddleware],
  summary: "Send a real FCM test push to the current user's registered browser tokens",
  request: {
    body: createApiJsonBody(notificationTestPushSchema),
  },
  responses: {
    202: createApiSuccessResponse(
      notificationTestPushResultSchema,
      "Test push queued successfully"
    ),
  },
});

export const getNotificationPreferences = createOpenApiRoute({
  method: "get",
  path: "/preferences",
  operationId: "notificationPreferencesGet",
  tags: userTags,
  middleware: [notificationRateLimit, authMiddleware],
  summary: "Get current user's notification preferences",
  responses: {
    200: createApiSuccessResponse(
      notificationPreferenceSchema,
      "Notification preferences fetched successfully"
    ),
  },
});

export const updateNotificationPreferences = createOpenApiRoute({
  method: "patch",
  path: "/preferences",
  operationId: "notificationPreferencesUpdate",
  tags: userTags,
  middleware: [notificationRateLimit, authMiddleware],
  summary: "Update current user's notification preferences",
  request: {
    body: createApiJsonBody(notificationPreferenceUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(
      notificationPreferenceSchema,
      "Notification preferences updated successfully"
    ),
  },
});

export const unregisterPushSubscriptionRoute = createOpenApiRoute({
  method: "post",
  path: "/push-subscriptions/unregister",
  operationId: "notificationUnregisterPushSubscription",
  tags: userTags,
  middleware: [notificationRateLimit, authMiddleware],
  summary: "Deactivate the current user's FCM web push token",
  request: {
    body: createApiJsonBody(notificationUnregisterPushSubscriptionSchema),
  },
  responses: {
    200: createApiSuccessResponse(
      notificationMutationResultSchema,
      "Push subscription unregistered"
    ),
  },
});

export const listNotificationTemplates = createOpenApiRoute({
  method: "get",
  path: "/templates",
  operationId: "proptryxNotificationTemplates",
  tags: proptryxTags,
  middleware: [notificationRateLimit, authMiddleware],
  summary: "List notification templates",
  request: {
    query: notificationTemplateListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(
      notificationTemplateListResultSchema,
      "Notification templates fetched successfully"
    ),
  },
});

export const getNotificationTemplate = createOpenApiRoute({
  method: "get",
  path: "/templates/{id}",
  operationId: "proptryxNotificationTemplateGet",
  tags: proptryxTags,
  middleware: [notificationRateLimit, authMiddleware],
  summary: "Get a notification template",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(notificationTemplateSchema, "Notification template fetched"),
  },
});

export const createNotificationTemplate = createOpenApiRoute({
  method: "post",
  path: "/templates",
  operationId: "proptryxNotificationTemplateCreate",
  tags: proptryxTags,
  middleware: [notificationRateLimit, notificationTemplateRbac.custom("create")],
  summary: "Create a notification template",
  request: {
    body: createApiJsonBody(notificationTemplateUpsertSchema),
  },
  responses: {
    200: createApiSuccessResponse(notificationTemplateSchema, "Notification template created"),
  },
});

export const updateNotificationTemplate = createOpenApiRoute({
  method: "patch",
  path: "/templates/{id}",
  operationId: "proptryxNotificationTemplateUpdate",
  tags: proptryxTags,
  middleware: [notificationRateLimit, notificationTemplateRbac.custom("update")],
  summary: "Update a notification template",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(notificationTemplateUpsertSchema.partial()),
  },
  responses: {
    200: createApiSuccessResponse(notificationTemplateSchema, "Notification template updated"),
  },
});

export const deleteNotificationTemplate = createOpenApiRoute({
  method: "delete",
  path: "/templates/{id}",
  operationId: "proptryxNotificationTemplateDelete",
  tags: proptryxTags,
  middleware: [notificationRateLimit, notificationTemplateRbac.custom("delete")],
  summary: "Delete a notification template",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(notificationTemplateSchema, "Notification template deleted"),
  },
});

export const listNotificationTriggerOptions = createOpenApiRoute({
  method: "get",
  path: "/triggers/options",
  operationId: "proptryxNotificationTriggerOptions",
  tags: proptryxTags,
  middleware: [notificationRateLimit, notificationTriggerRbac.custom("getAll")],
  summary: "List available notification trigger operations",
  responses: {
    200: createApiSuccessResponse(
      notificationTriggerOptionsSchema,
      "Notification trigger options fetched"
    ),
  },
});

export const listNotificationTriggers = createOpenApiRoute({
  method: "get",
  path: "/triggers",
  operationId: "proptryxNotificationTriggers",
  tags: proptryxTags,
  middleware: [notificationRateLimit, notificationTriggerRbac.custom("getAll")],
  summary: "List notification triggers",
  request: {
    query: notificationTriggerListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(
      notificationTriggerListResultSchema,
      "Notification triggers fetched"
    ),
  },
});

export const listNotificationTriggerExecutions = createOpenApiRoute({
  method: "get",
  path: "/triggers/{id}/executions",
  operationId: "proptryxNotificationTriggerExecutions",
  tags: proptryxTags,
  middleware: [notificationRateLimit, notificationTriggerRbac.custom("get")],
  summary: "List notification trigger execution records",
  request: {
    params: IdStringParamSchema(),
    query: notificationTriggerExecutionListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(
      notificationTriggerExecutionListResultSchema,
      "Notification trigger executions fetched"
    ),
  },
});

export const getNotificationTrigger = createOpenApiRoute({
  method: "get",
  path: "/triggers/{id}",
  operationId: "proptryxNotificationTriggerGet",
  tags: proptryxTags,
  middleware: [notificationRateLimit, notificationTriggerRbac.custom("get")],
  summary: "Get a notification trigger",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(notificationTriggerSchema, "Notification trigger fetched"),
  },
});

export const createNotificationTrigger = createOpenApiRoute({
  method: "post",
  path: "/triggers",
  operationId: "proptryxNotificationTriggerCreate",
  tags: proptryxTags,
  middleware: [notificationRateLimit, notificationTriggerRbac.custom("create")],
  summary: "Create a notification trigger",
  request: {
    body: createApiJsonBody(notificationTriggerUpsertSchema),
  },
  responses: {
    200: createApiSuccessResponse(notificationTriggerSchema, "Notification trigger created"),
  },
});

export const updateNotificationTrigger = createOpenApiRoute({
  method: "patch",
  path: "/triggers/{id}",
  operationId: "proptryxNotificationTriggerUpdate",
  tags: proptryxTags,
  middleware: [notificationRateLimit, notificationTriggerRbac.custom("update")],
  summary: "Update a notification trigger",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(notificationTriggerBaseInputSchema.partial()),
  },
  responses: {
    200: createApiSuccessResponse(notificationTriggerSchema, "Notification trigger updated"),
  },
});

export const deleteNotificationTrigger = createOpenApiRoute({
  method: "delete",
  path: "/triggers/{id}",
  operationId: "proptryxNotificationTriggerDelete",
  tags: proptryxTags,
  middleware: [notificationRateLimit, notificationTriggerRbac.custom("delete")],
  summary: "Soft delete a notification trigger",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(notificationTriggerSchema, "Notification trigger soft deleted"),
  },
});

export const permanentlyDeleteNotificationTrigger = createOpenApiRoute({
  method: "delete",
  path: "/triggers/{id}/permanent",
  operationId: "proptryxNotificationTriggerPermanentDelete",
  tags: proptryxTags,
  middleware: [notificationRateLimit, notificationTriggerRbac.custom("delete")],
  summary: "Permanently delete a notification trigger",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      notificationTriggerSchema,
      "Notification trigger permanently deleted"
    ),
  },
});

export const testNotificationTrigger = createOpenApiRoute({
  method: "post",
  path: "/triggers/{id}/test",
  operationId: "proptryxNotificationTriggerTest",
  tags: proptryxTags,
  middleware: [notificationRateLimit, notificationTriggerRbac.custom("create")],
  summary: "Execute a notification trigger test for the current user",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(notificationTriggerTestSchema),
  },
  responses: {
    202: createApiSuccessResponse(
      notificationTriggerTestResultSchema,
      "Notification trigger test executed"
    ),
  },
});

export const sendProptryxNotification = createOpenApiRoute({
  method: "post",
  path: "/send",
  operationId: "proptryxNotificationSend",
  tags: proptryxTags,
  middleware: [notificationRateLimit, notificationRbac.custom("send")],
  summary: "Send a custom or templated notification from the Proptryx panel",
  request: {
    body: createApiJsonBody(proptryxNotificationSendSchema),
  },
  responses: {
    202: createApiSuccessResponse(proptryxNotificationSendResultSchema, "Notification queued"),
  },
});

export const broadcastProptryxNotification = createOpenApiRoute({
  method: "post",
  path: "/broadcast",
  operationId: "proptryxNotificationBroadcast",
  tags: proptryxTags,
  middleware: [notificationRateLimit, notificationRbac.custom("broadcast")],
  summary: "Broadcast a custom or templated notification from the Proptryx panel",
  request: {
    body: createApiJsonBody(proptryxNotificationBroadcastSchema),
  },
  responses: {
    202: createApiSuccessResponse(
      proptryxNotificationSendResultSchema,
      "Notification broadcast queued"
    ),
  },
});

export const notifyPropertyPublished = createOpenApiRoute({
  method: "post",
  path: "/property-published",
  operationId: "internalNotificationPropertyPublished",
  tags: internalTags,
  middleware: [notificationRateLimit],
  summary: "Queue property-published notifications from an internal service event",
  request: {
    body: createApiJsonBody(internalPropertyPublishedNotificationSchema),
  },
  responses: {
    202: createApiSuccessResponse(
      proptryxNotificationSendResultSchema,
      "Notification event queued"
    ),
  },
});

export const notifyResourceEvent = createOpenApiRoute({
  method: "post",
  path: "/resource-event",
  operationId: "internalNotificationResourceEvent",
  tags: internalTags,
  middleware: [notificationRateLimit],
  summary: "Execute a configured notification trigger from an internal resource event",
  request: {
    body: createApiJsonBody(internalResourceEventNotificationSchema),
  },
  responses: {
    202: createApiSuccessResponse(
      proptryxNotificationSendResultSchema,
      "Notification trigger event processed"
    ),
  },
});
