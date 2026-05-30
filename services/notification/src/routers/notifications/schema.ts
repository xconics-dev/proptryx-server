import {
  NotificationAudiencePanel,
  NotificationDeliveryChannel,
  notification,
  notificationPreference,
  notificationPushSubscription,
  notificationTemplate,
  notificationTrigger,
  notificationTriggerExecution,
} from "@proptryx/database";
import {
  createDbInsertSchema,
  createDbSelectSchema,
  createListQuerySchema,
  createListResponseSchema,
  optionalBooleanQuerySchema,
} from "@proptryx/utils";
import type { z } from "@hono/zod-openapi";
import zod from "zod";

const pushDataValueSchema = zod.union([zod.string(), zod.number(), zod.boolean(), zod.null()]);
const jsonRecordSchema = zod.record(zod.string(), pushDataValueSchema).default({});
const audienceRoleSchema = zod.string().trim().min(1);
const optionalDateQuerySchema = zod.preprocess((value) => {
  if (value === "" || value === undefined || value === null) {
    return undefined;
  }

  return value;
}, zod.coerce.date().optional());

export const notificationSchema = createDbSelectSchema(notification);
export const notificationPreferenceSchema = createDbSelectSchema(notificationPreference);
export const notificationPushSubscriptionSchema = createDbSelectSchema(
  notificationPushSubscription
);
export const notificationTemplateSchema = createDbSelectSchema(notificationTemplate);
export const notificationTriggerSchema = createDbSelectSchema(notificationTrigger);
export const notificationTriggerExecutionSchema = createDbSelectSchema(
  notificationTriggerExecution
);

export const notificationListSortFields = ["createdAt", "updatedAt", "readAt", "title"] as const;

export const notificationListQuerySchema = createListQuerySchema({
  sortFields: notificationListSortFields,
  extraShape: {
    unreadOnly: optionalBooleanQuerySchema,
    includeRead: optionalBooleanQuerySchema,
    status: zod.enum(["active", "unread", "read", "archived", "deleted", "all"]).optional(),
    relatedEntityType: zod.string().trim().min(1).optional(),
    relatedEntityId: zod.string().trim().min(1).optional(),
  },
});

export type NotificationListQuery = z.infer<typeof notificationListQuerySchema>;

export const notificationListResponseSchema = createListResponseSchema(notificationSchema);

export const notificationUnreadCountSchema = zod.object({
  count: zod.number().int().nonnegative(),
});

export const notificationRegisterPushSubscriptionSchema = createDbInsertSchema(
  notificationPushSubscription,
  {
    omit: ["id", "userId", "isActive", "lastSeenAt", "createdAt", "updatedAt"],
    customizeSchema(schema) {
      return schema.extend({
        token: zod.string().trim().min(1, "FCM token is required"),
        deviceId: zod.string().trim().min(1).nullable().optional(),
        platform: zod.string().trim().min(1).nullable().optional(),
        browser: zod.string().trim().min(1).nullable().optional(),
        userAgent: zod.string().trim().min(1).nullable().optional(),
      });
    },
  }
);

export const notificationUnregisterPushSubscriptionSchema = zod.object({
  token: zod.string().trim().min(1, "FCM token is required"),
});

export const notificationMutationResultSchema = zod.object({
  message: zod.string(),
});

export const notificationTestPushResultSchema = zod.object({
  message: zod.string(),
  dashboardNotificationCount: zod.number().int().nonnegative(),
  pushSubscriptionCount: zod.number().int().nonnegative(),
  requested: zod.number().int().nonnegative(),
  successCount: zod.number().int().nonnegative(),
  failureCount: zod.number().int().nonnegative(),
  invalidTokens: zod.array(zod.string()),
  skipped: zod.boolean(),
});

export const notificationPreferenceUpdateSchema = zod
  .object({
    emailNotificationsEnabled: zod.boolean().optional(),
    dashboardNotificationsEnabled: zod.boolean().optional(),
    pushNotificationsEnabled: zod.boolean().optional(),
    browserPermissionPromptedAt: zod.string().datetime().nullable().optional(),
    browserPermissionStatus: zod.enum(["default", "granted", "denied"]).nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one preference field is required",
  });

export const notificationTemplateListSortFields = [
  "key",
  "name",
  "title",
  "createdAt",
  "updatedAt",
] as const;

export const notificationTemplateListQuerySchema = createListQuerySchema({
  sortFields: notificationTemplateListSortFields,
  extraShape: {
    includeSystem: optionalBooleanQuerySchema,
    isActive: optionalBooleanQuerySchema,
  },
});
export type NotificationTemplateListQuery = z.infer<typeof notificationTemplateListQuerySchema>;

export const notificationTemplateListResultSchema = createListResponseSchema(
  notificationTemplateSchema
);

export const notificationTriggerListSortFields = [
  "key",
  "name",
  "sourceService",
  "resource",
  "operation",
  "phase",
  "createdAt",
  "updatedAt",
] as const;

export const notificationTriggerListQuerySchema = createListQuerySchema({
  sortFields: notificationTriggerListSortFields,
  extraShape: {
    sourceService: zod.string().trim().min(1).optional(),
    resource: zod.string().trim().min(1).optional(),
    operation: zod.string().trim().min(1).optional(),
    phase: zod.enum(["before", "after"]).optional(),
    isActive: optionalBooleanQuerySchema,
  },
});
export type NotificationTriggerListQuery = z.infer<typeof notificationTriggerListQuerySchema>;

export const notificationTriggerListResultSchema =
  createListResponseSchema(notificationTriggerSchema);

export const notificationTriggerExecutionListSortFields = [
  "executedAt",
  "status",
  "resource",
  "operation",
  "phase",
] as const;

export const notificationTriggerExecutionListQuerySchema = createListQuerySchema({
  sortFields: notificationTriggerExecutionListSortFields,
  extraShape: {
    status: zod.enum(["success", "failed"]).optional(),
    startDate: optionalDateQuerySchema,
    endDate: optionalDateQuerySchema,
  },
});
export type NotificationTriggerExecutionListQuery = z.infer<
  typeof notificationTriggerExecutionListQuerySchema
>;

export const notificationTriggerExecutionListResultSchema = createListResponseSchema(
  notificationTriggerExecutionSchema
);

export const notificationTriggerOptionSchema = zod.object({
  key: zod.string(),
  label: zod.string(),
  sourceService: zod.string(),
  resource: zod.string(),
  resourceLabel: zod.string(),
  operation: zod.string(),
  operationLabel: zod.string(),
  phase: zod.enum(["before", "after"]),
  variables: zod.array(zod.string()),
});

export const notificationTriggerOptionsSchema = zod.object({
  options: zod.array(notificationTriggerOptionSchema),
});

export const notificationTemplateUpsertSchema = zod.object({
  key: zod.string().trim().min(1, "Template key is required").max(120),
  name: zod.string().trim().min(1, "Template name is required").max(160),
  title: zod.string().trim().min(1, "Title is required").max(160),
  body: zod.string().trim().min(1, "Message body is required").max(2000),
  icon: zod.string().trim().min(1).nullable().optional(),
  image: zod.string().trim().min(1).nullable().optional(),
  actionUrl: zod.string().trim().min(1).nullable().optional(),
  data: jsonRecordSchema.optional(),
  isActive: zod.boolean().optional(),
});

export const notificationTriggerBaseInputSchema = zod.object({
  key: zod.string().trim().min(1, "Trigger key is required").max(180),
  name: zod.string().trim().min(1, "Trigger name is required").max(180),
  description: zod.string().trim().min(1).max(2000).nullable().optional(),
  sourceService: zod.string().trim().min(1, "Source service is required").max(80),
  resource: zod.string().trim().min(1, "Resource is required").max(120),
  operation: zod.string().trim().min(1, "Operation is required").max(80),
  phase: zod.enum(["before", "after"]).default("after"),
  deliveryChannel: zod.enum(NotificationDeliveryChannel.enumValues).default("BOTH"),
  audiencePanel: zod.enum(NotificationAudiencePanel.enumValues).default("ALL"),
  audienceRole: audienceRoleSchema.nullable().optional(),
  audienceRoles: zod.array(audienceRoleSchema).optional(),
  recipientStrategy: zod
    .enum(["resource_owner", "created_by_user", "organization_members", "role_members", "custom"])
    .default("resource_owner"),
  templateKey: zod.string().trim().min(1).nullable().optional(),
  title: zod.string().trim().min(1).max(160).nullable().optional(),
  body: zod.string().trim().min(1).max(2000).nullable().optional(),
  icon: zod.string().trim().min(1).nullable().optional(),
  image: zod.string().trim().min(1).nullable().optional(),
  actionUrl: zod.string().trim().min(1).nullable().optional(),
  tag: zod.string().trim().min(1).nullable().optional(),
  data: jsonRecordSchema.optional(),
  conditions: jsonRecordSchema.optional(),
  isActive: zod.boolean().optional(),
});

export const notificationTriggerUpsertSchema = notificationTriggerBaseInputSchema.refine(
  (value) => value.templateKey || (value.title && value.body),
  {
    message: "Choose a template or enter a custom title and body",
    path: ["templateKey"],
  }
);

export const notificationCustomPayloadSchema = zod.object({
  title: zod.string().trim().min(1, "Title is required").max(160),
  body: zod.string().trim().min(1, "Message body is required").max(2000),
  icon: zod.string().trim().min(1).nullable().optional(),
  image: zod.string().trim().min(1).nullable().optional(),
  badge: zod.string().trim().min(1).nullable().optional(),
  actionUrl: zod.string().trim().min(1).nullable().optional(),
  tag: zod.string().trim().min(1).nullable().optional(),
  priority: zod.enum(["normal", "high"]).optional(),
  data: jsonRecordSchema.optional(),
  relatedEntityType: zod.string().trim().min(1).nullable().optional(),
  relatedEntityId: zod.string().trim().min(1).nullable().optional(),
});

export const notificationTestPushSchema = notificationCustomPayloadSchema.extend({
  deliveryChannel: zod.enum(NotificationDeliveryChannel.enumValues).default("PUSH"),
});

export const notificationTemplatePayloadSchema = zod.object({
  templateKey: zod.string().trim().min(1, "Template key is required"),
  variables: jsonRecordSchema.optional(),
  overrides: notificationCustomPayloadSchema.partial().optional(),
});

export const proptryxNotificationSendSchema = zod
  .object({
    recipientUserIds: zod.array(zod.string().trim().min(1)).min(1).optional(),
    organizationId: zod.string().trim().min(1).optional(),
    audiencePanel: zod.enum(NotificationAudiencePanel.enumValues).default("PROPTRYX"),
    audienceRole: audienceRoleSchema.nullable().optional(),
    audienceRoles: zod.array(audienceRoleSchema).min(1).optional(),
    deliveryChannel: zod.enum(NotificationDeliveryChannel.enumValues).default("BOTH"),
    custom: notificationCustomPayloadSchema.optional(),
    template: notificationTemplatePayloadSchema.optional(),
  })
  .refine((value) => value.custom || value.template, {
    message: "Either custom or template payload is required",
    path: ["custom"],
  })
  .refine(
    (value) =>
      value.recipientUserIds ||
      value.organizationId ||
      value.audienceRole ||
      value.audienceRoles ||
      value.audiencePanel !== "ALL",
    {
      message: "Choose recipients, a role, or an all-panel broadcast",
      path: ["recipientUserIds"],
    }
  );

export const proptryxNotificationBroadcastSchema = zod
  .object({
    organizationId: zod.string().trim().min(1).optional(),
    audiencePanel: zod.enum(NotificationAudiencePanel.enumValues).default("PROPTRYX"),
    audienceRole: audienceRoleSchema.nullable().optional(),
    audienceRoles: zod.array(audienceRoleSchema).min(1).optional(),
    deliveryChannel: zod.enum(NotificationDeliveryChannel.enumValues).default("BOTH"),
    custom: notificationCustomPayloadSchema.optional(),
    template: notificationTemplatePayloadSchema.optional(),
  })
  .refine((value) => value.custom || value.template, {
    message: "Either custom or template payload is required",
    path: ["custom"],
  });

export const proptryxNotificationSendResultSchema = zod.object({
  broadcastId: zod.string().nullable(),
  recipientCount: zod.number().int().nonnegative(),
  dashboardNotificationCount: zod.number().int().nonnegative(),
  pushSubscriptionCount: zod.number().int().nonnegative(),
  message: zod.string(),
});

const propertyPublishedRecipientSchema = zod.object({
  id: zod.string().trim().min(1),
  name: zod.string().trim().min(1).nullable(),
  email: zod.string().email(),
});

export const internalPropertyPublishedNotificationSchema = zod.object({
  propertyId: zod.string().trim().min(1),
  propertyName: zod.string().trim().min(1),
  organizationName: zod.string().trim().min(1),
  publishedAt: zod.string().datetime(),
  propertyOwner: propertyPublishedRecipientSchema.nullable(),
  organizationOwners: zod.array(propertyPublishedRecipientSchema).default([]),
});

export const internalResourceEventNotificationSchema = zod.object({
  sourceService: zod.string().trim().min(1).max(80),
  resource: zod.string().trim().min(1).max(120),
  operation: zod.string().trim().min(1).max(80),
  phase: zod.enum(["before", "after"]).default("after"),
  recipientUserIds: zod.array(zod.string().trim().min(1)).optional(),
  organizationId: zod.string().trim().min(1).nullable().optional(),
  variables: jsonRecordSchema.optional(),
  data: jsonRecordSchema.optional(),
  relatedEntityType: zod.string().trim().min(1).nullable().optional(),
  relatedEntityId: zod.string().trim().min(1).nullable().optional(),
  defaultTitle: zod.string().trim().min(1).max(160).nullable().optional(),
  defaultBody: zod.string().trim().min(1).max(2000).nullable().optional(),
  defaultActionUrl: zod.string().trim().min(1).nullable().optional(),
  defaultTag: zod.string().trim().min(1).nullable().optional(),
  defaultIcon: zod.string().trim().min(1).nullable().optional(),
  defaultImage: zod.string().trim().min(1).nullable().optional(),
});

export const notificationTriggerTestSchema = zod.object({
  variables: jsonRecordSchema.optional(),
  data: jsonRecordSchema.optional(),
  relatedEntityType: zod.string().trim().min(1).nullable().optional(),
  relatedEntityId: zod.string().trim().min(1).nullable().optional(),
});

export const notificationTriggerTestResultSchema = proptryxNotificationSendResultSchema.extend({
  renderedTitle: zod.string(),
  renderedBody: zod.string(),
  renderedActionUrl: zod.string().nullable(),
  renderedTag: zod.string().nullable(),
});

export type ProptryxNotificationSendInput = z.infer<typeof proptryxNotificationSendSchema>;
export type ProptryxNotificationBroadcastInput = z.infer<
  typeof proptryxNotificationBroadcastSchema
>;
export type NotificationTemplateUpsertInput = z.infer<typeof notificationTemplateUpsertSchema>;
export type NotificationTriggerUpsertInput = z.infer<typeof notificationTriggerUpsertSchema>;
export type NotificationTestPushInput = z.infer<typeof notificationTestPushSchema>;
export type InternalPropertyPublishedNotificationInput = z.infer<
  typeof internalPropertyPublishedNotificationSchema
>;
export type InternalResourceEventNotificationInput = z.infer<
  typeof internalResourceEventNotificationSchema
>;
export type NotificationTriggerTestInput = z.infer<typeof notificationTriggerTestSchema>;
