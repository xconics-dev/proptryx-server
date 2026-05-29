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
  notificationUnreadCountSchema,
  notificationUnregisterPushSubscriptionSchema,
  internalPropertyPublishedNotificationSchema,
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
