import {
  getDB,
  notification,
  notificationTemplate,
  notificationTrigger,
  notificationTriggerExecution,
} from "@proptryx/database";
import { createTableListFetcher } from "@proptryx/utils";
import { and, eq, gte, isNotNull, isNull, lte, notInArray } from "drizzle-orm";
import { SYSTEM_NOTIFICATION_TEMPLATE_KEYS } from "./constants";
import type {
  NotificationListQuery,
  NotificationTemplateListQuery,
  NotificationTriggerExecutionListQuery,
  NotificationTriggerListQuery,
} from "./schema";

export const fetchNotificationList = createTableListFetcher<
  typeof notification,
  typeof notification.$inferSelect,
  NotificationListQuery & { userId: string }
>({
  db: getDB,
  table: notification,
  where: ({ params }) =>
    and(
      eq(notification.userId, params.userId),
      params.status === "archived" ? isNotNull(notification.archivedAt) : undefined,
      params.status === "deleted" ? isNotNull(notification.deletedAt) : undefined,
      !params.status ||
        params.status === "active" ||
        params.status === "unread" ||
        params.status === "read"
        ? isNull(notification.archivedAt)
        : undefined,
      !params.status ||
        params.status === "active" ||
        params.status === "unread" ||
        params.status === "read"
        ? isNull(notification.deletedAt)
        : undefined,
      params.unreadOnly || params.status === "unread" ? isNull(notification.readAt) : undefined,
      params.status === "read" ? isNotNull(notification.readAt) : undefined
    ),
  search: {
    exact: [notification.id, notification.relatedEntityId],
    contains: [notification.title, notification.body, notification.relatedEntityType],
  },
  filterColumns: {
    relatedEntityType: notification.relatedEntityType,
    relatedEntityId: notification.relatedEntityId,
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    createdAt: notification.createdAt,
    updatedAt: notification.updatedAt,
    readAt: notification.readAt,
    title: notification.title,
  },
});

export const fetchNotificationTemplateList = createTableListFetcher<
  typeof notificationTemplate,
  typeof notificationTemplate.$inferSelect,
  NotificationTemplateListQuery
>({
  db: getDB,
  table: notificationTemplate,
  where: ({ params }) =>
    and(
      params.includeSystem === false
        ? notInArray(notificationTemplate.key, [...SYSTEM_NOTIFICATION_TEMPLATE_KEYS])
        : undefined,
      params.isActive === undefined ? undefined : eq(notificationTemplate.isActive, params.isActive)
    ),
  search: {
    exact: [notificationTemplate.id, notificationTemplate.key],
    contains: [
      notificationTemplate.name,
      notificationTemplate.title,
      notificationTemplate.body,
      notificationTemplate.actionUrl,
    ],
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    key: notificationTemplate.key,
    name: notificationTemplate.name,
    title: notificationTemplate.title,
    createdAt: notificationTemplate.createdAt,
    updatedAt: notificationTemplate.updatedAt,
  },
});

export const fetchNotificationTriggerList = createTableListFetcher<
  typeof notificationTrigger,
  typeof notificationTrigger.$inferSelect,
  NotificationTriggerListQuery
>({
  db: getDB,
  table: notificationTrigger,
  where: ({ params }) =>
    and(
      params.sourceService
        ? eq(notificationTrigger.sourceService, params.sourceService)
        : undefined,
      params.resource ? eq(notificationTrigger.resource, params.resource) : undefined,
      params.operation ? eq(notificationTrigger.operation, params.operation) : undefined,
      params.phase ? eq(notificationTrigger.phase, params.phase) : undefined,
      params.isActive === undefined ? undefined : eq(notificationTrigger.isActive, params.isActive),
      eq(notificationTrigger.isDeleted, false)
    ),
  search: {
    exact: [notificationTrigger.id, notificationTrigger.key],
    contains: [
      notificationTrigger.name,
      notificationTrigger.description,
      notificationTrigger.sourceService,
      notificationTrigger.resource,
      notificationTrigger.operation,
      notificationTrigger.title,
      notificationTrigger.body,
    ],
  },
  sorting: {
    defaultBy: "createdAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    key: notificationTrigger.key,
    name: notificationTrigger.name,
    sourceService: notificationTrigger.sourceService,
    resource: notificationTrigger.resource,
    operation: notificationTrigger.operation,
    phase: notificationTrigger.phase,
    createdAt: notificationTrigger.createdAt,
    updatedAt: notificationTrigger.updatedAt,
  },
});

export const fetchNotificationTriggerExecutionList = createTableListFetcher<
  typeof notificationTriggerExecution,
  typeof notificationTriggerExecution.$inferSelect,
  NotificationTriggerExecutionListQuery & { triggerId: string }
>({
  db: getDB,
  table: notificationTriggerExecution,
  where: ({ params }) =>
    and(
      eq(notificationTriggerExecution.triggerId, params.triggerId),
      params.status ? eq(notificationTriggerExecution.status, params.status) : undefined,
      params.startDate ? gte(notificationTriggerExecution.executedAt, params.startDate) : undefined,
      params.endDate ? lte(notificationTriggerExecution.executedAt, params.endDate) : undefined
    ),
  search: {
    exact: [
      notificationTriggerExecution.id,
      notificationTriggerExecution.relatedEntityId,
      notificationTriggerExecution.status,
    ],
    contains: [
      notificationTriggerExecution.sourceService,
      notificationTriggerExecution.resource,
      notificationTriggerExecution.operation,
      notificationTriggerExecution.relatedEntityType,
      notificationTriggerExecution.error,
    ],
  },
  sorting: {
    defaultBy: "executedAt",
    defaultOrder: "desc",
  },
  sortColumns: {
    executedAt: notificationTriggerExecution.executedAt,
    status: notificationTriggerExecution.status,
    resource: notificationTriggerExecution.resource,
    operation: notificationTriggerExecution.operation,
    phase: notificationTriggerExecution.phase,
  },
});
