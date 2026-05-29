import { getDB, notification, notificationTemplate } from "@proptryx/database";
import { createTableListFetcher } from "@proptryx/utils";
import { and, eq, isNotNull, isNull, notInArray } from "drizzle-orm";
import { SYSTEM_NOTIFICATION_TEMPLATE_KEYS } from "./constants";
import type { NotificationListQuery, NotificationTemplateListQuery } from "./schema";

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
