import {
  db,
  notification,
  notificationPreference,
  notificationPushSubscription,
  notificationTemplate,
  notificationTriggerExecution,
  member,
  user,
  type NotificationAudiencePanel,
  type NotificationDeliveryChannel,
} from "@proptryx/database";
import {
  isFirebasePushConfigured,
  renderPushNotificationTemplate,
  sendPushToTokens,
  type PushNotificationPayload,
} from "@proptryx/notification";
import { generateRandomId } from "@proptryx/utils";
import { and, eq, inArray, isNull, isNotNull, lte, ne, or } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { SYSTEM_NOTIFICATION_TEMPLATE_KEYS } from "./constants";
import type { ProptryxNotificationBroadcastInput, ProptryxNotificationSendInput } from "./schema";

const NOTIFICATION_DELETE_PURGE_AFTER_MS = 10 * 60 * 60 * 1000;
const NOTIFICATION_TRIGGER_EXECUTION_PURGE_AFTER_MS = 10 * 24 * 60 * 60 * 1000;
const PUSH_SUBSCRIPTION_INACTIVE_PURGE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;
const PUSH_SUBSCRIPTION_STALE_PURGE_AFTER_MS = 90 * 24 * 60 * 60 * 1000;
const NOTIFICATION_DELETE_PURGE_INTERVAL_MS = 60 * 60 * 1000;
const NOTIFICATION_DELETE_PURGE_INITIAL_DELAY_MS = 5_000;

type DeliveryChannel = (typeof NotificationDeliveryChannel.enumValues)[number];
type AudiencePanel = (typeof NotificationAudiencePanel.enumValues)[number];

interface ResolveRecipientsOptions {
  recipientUserIds?: string[];
  organizationId?: string;
  audiencePanel?: AudiencePanel;
  audienceRole?: string | null;
  audienceRoles?: string[];
}

interface SendNotificationOptions {
  recipientUserIds: string[];
  audiencePanel: AudiencePanel;
  audienceRole?: string | null;
  deliveryChannel: DeliveryChannel;
  payload: PushNotificationPayload;
  templateKey?: string | null;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  broadcastId?: string | null;
  createdByUser?: string | null;
}

type NotificationPreferenceRecord = typeof notificationPreference.$inferSelect;
type NotificationRecord = typeof notification.$inferSelect;
type RealtimeSend = (notification: NotificationRecord) => void;
const realtimeSubscribers = new Map<string, Set<RealtimeSend>>();

const DEFAULT_NOTIFICATION_PREFERENCE = {
  emailNotificationsEnabled: true,
  dashboardNotificationsEnabled: true,
  pushNotificationsEnabled: true,
} as const;
const DEFAULT_NOTIFICATION_ICON = "/logo/logo.png";
const DEFAULT_NOTIFICATION_BADGE = "/logo/logo.png";
const DOUBLE_BRACE_VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
const SINGLE_BRACE_VARIABLE_PATTERN = /\{([a-zA-Z0-9_.-]+)\}/g;

let notificationDeletePurgeCronStarted = false;
let notificationDeletePurgeCronPromise: Promise<void> | null = null;

function normalizeAudienceRoles(input: { audienceRole?: string | null; audienceRoles?: string[] }) {
  return [
    ...(input.audienceRole ? [input.audienceRole] : []),
    ...(input.audienceRoles ?? []),
  ].filter((role, index, roles) => roles.indexOf(role) === index);
}

function renderTemplateValue(value: string | null | undefined, variables: Record<string, unknown>) {
  if (!value) {
    return undefined;
  }

  return value
    .replace(DOUBLE_BRACE_VARIABLE_PATTERN, (match, key: string) => {
      const replacement = variables[key];
      return replacement == null ? match : String(replacement);
    })
    .replace(SINGLE_BRACE_VARIABLE_PATTERN, (match, key: string) => {
      const replacement = variables[key];
      return replacement == null ? match : String(replacement);
    });
}

function renderTemplateData(
  data: Record<string, unknown>,
  variables: Record<string, unknown>
): Record<string, string | number | boolean | null> {
  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      typeof value === "string"
        ? (renderTemplateValue(value, variables) ?? "")
        : typeof value === "number" || typeof value === "boolean" || value === null
          ? value
          : String(value),
    ])
  ) as Record<string, string | number | boolean | null>;
}

export async function ensureNotificationTemplatesSeeded() {
  const seeds = [
    {
      id: "notification_template_property_published",
      key: "property-published",
      name: "Property published",
      title: "Property published",
      body: "{{propertyName}} is now published.",
      actionUrl: "/data/directory/property/control/{{propertyId}}",
      icon: DEFAULT_NOTIFICATION_ICON,
      data: { type: "property-published" },
    },
  ];

  await db.delete(notificationTemplate).where(eq(notificationTemplate.key, "custom-announcement"));

  await db
    .insert(notificationTemplate)
    .values(seeds)
    .onConflictDoUpdate({
      target: notificationTemplate.key,
      set: {
        name: "Property published",
        title: "Property published",
        body: "{{propertyName}} is now published.",
        actionUrl: "/data/directory/property/control/{{propertyId}}",
        icon: DEFAULT_NOTIFICATION_ICON,
        data: { type: "property-published" },
        isActive: true,
        updatedAt: new Date(),
      },
    });
}

export async function deleteNotificationTemplate(id: string) {
  const template = await db
    .select()
    .from(notificationTemplate)
    .where(eq(notificationTemplate.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!template) {
    return null;
  }

  if (SYSTEM_NOTIFICATION_TEMPLATE_KEYS.includes(template.key as never)) {
    throw new Error("System notification templates cannot be deleted");
  }

  const [deleted] = await db
    .delete(notificationTemplate)
    .where(eq(notificationTemplate.id, id))
    .returning();

  return deleted ?? template;
}

export async function resolveNotificationRecipients({
  recipientUserIds,
  organizationId,
  audiencePanel = "PROPTRYX",
  audienceRole,
  audienceRoles,
}: ResolveRecipientsOptions) {
  const resolvedRoles = normalizeAudienceRoles({ audienceRole, audienceRoles });

  if (organizationId) {
    const filters = [
      eq(member.organizationId, organizationId),
      eq(member.isDeleted, false),
      eq(user.isDeleted, false),
    ];

    if (resolvedRoles.length > 0) {
      filters.push(inArray(member.role, resolvedRoles));
    }

    return db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: member.role,
        panel: member.panel,
      })
      .from(member)
      .innerJoin(user, eq(user.id, member.userId))
      .where(and(...filters));
  }

  const filters = [eq(user.isDeleted, false)];

  if (recipientUserIds?.length) {
    filters.push(inArray(user.id, [...new Set(recipientUserIds)]));
  }

  if (audiencePanel !== "ALL") {
    filters.push(eq(user.panel, audiencePanel.toLowerCase() as "proptryx" | "company"));
  }

  if (resolvedRoles.length > 0) {
    filters.push(inArray(user.role, resolvedRoles));
  }

  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      panel: user.panel,
    })
    .from(user)
    .where(and(...filters));
}

export async function resolveNotificationPayload(
  input: Pick<
    ProptryxNotificationSendInput | ProptryxNotificationBroadcastInput,
    "custom" | "template"
  >
) {
  if (input.template) {
    if (!SYSTEM_NOTIFICATION_TEMPLATE_KEYS.includes(input.template.templateKey as never)) {
      const template = await db
        .select()
        .from(notificationTemplate)
        .where(
          and(
            eq(notificationTemplate.key, input.template.templateKey),
            eq(notificationTemplate.isActive, true)
          )
        )
        .limit(1)
        .then((rows) => rows[0]);

      if (!template) {
        throw new Error("Notification template not found or inactive");
      }

      const variables = input.template.variables ?? {};
      const overrides = input.template.overrides ?? {};

      return {
        payload: {
          title: renderTemplateValue(template.title, variables) ?? "",
          body: renderTemplateValue(template.body, variables) ?? "",
          icon: renderTemplateValue(template.icon, variables) ?? DEFAULT_NOTIFICATION_ICON,
          badge: DEFAULT_NOTIFICATION_BADGE,
          image: renderTemplateValue(template.image, variables),
          actionUrl: renderTemplateValue(template.actionUrl, variables),
          data: renderTemplateData(template.data ?? {}, variables),
          ...overrides,
        },
        templateKey: input.template.templateKey,
      };
    }

    return {
      payload: renderPushNotificationTemplate({
        templateKey: input.template.templateKey,
        variables: input.template.variables,
        overrides: input.template.overrides,
      }),
      templateKey: input.template.templateKey,
    };
  }

  if (!input.custom) {
    throw new Error("Notification payload is required");
  }

  const {
    relatedEntityType: _relatedEntityType,
    relatedEntityId: _relatedEntityId,
    ...payload
  } = input.custom;

  return {
    payload: {
      icon: DEFAULT_NOTIFICATION_ICON,
      badge: DEFAULT_NOTIFICATION_BADGE,
      ...payload,
    },
    templateKey: null,
  };
}

export async function getActivePushSubscriptionTokens(userIds: string[]) {
  if (userIds.length === 0) {
    return [];
  }

  return db
    .select({
      token: notificationPushSubscription.token,
    })
    .from(notificationPushSubscription)
    .where(
      and(
        inArray(notificationPushSubscription.userId, userIds),
        eq(notificationPushSubscription.isActive, true)
      )
    );
}

export async function getNotificationPreferencesForUsers(userIds: string[]) {
  const uniqueUserIds = [...new Set(userIds)];

  if (uniqueUserIds.length === 0) {
    return new Map<string, typeof DEFAULT_NOTIFICATION_PREFERENCE>();
  }

  const rows = await db
    .select()
    .from(notificationPreference)
    .where(inArray(notificationPreference.userId, uniqueUserIds));

  const byUserId = new Map<string, NotificationPreferenceRecord>(
    rows.map((row) => [row.userId, row])
  );

  return new Map(
    uniqueUserIds.map((userId) => [
      userId,
      {
        emailNotificationsEnabled:
          byUserId.get(userId)?.emailNotificationsEnabled ??
          DEFAULT_NOTIFICATION_PREFERENCE.emailNotificationsEnabled,
        dashboardNotificationsEnabled:
          byUserId.get(userId)?.dashboardNotificationsEnabled ??
          DEFAULT_NOTIFICATION_PREFERENCE.dashboardNotificationsEnabled,
        pushNotificationsEnabled:
          byUserId.get(userId)?.pushNotificationsEnabled ??
          DEFAULT_NOTIFICATION_PREFERENCE.pushNotificationsEnabled,
      },
    ])
  );
}

export async function getOrCreateNotificationPreference(userId: string) {
  const existing = await db
    .select()
    .from(notificationPreference)
    .where(eq(notificationPreference.userId, userId))
    .limit(1)
    .then((rows) => rows[0]);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(notificationPreference)
    .values({
      id: generateRandomId(),
      userId,
    })
    .returning();

  return created;
}

export async function updateNotificationPreference(
  userId: string,
  input: Partial<
    Pick<
      NotificationPreferenceRecord,
      | "emailNotificationsEnabled"
      | "dashboardNotificationsEnabled"
      | "pushNotificationsEnabled"
      | "browserPermissionPromptedAt"
      | "browserPermissionStatus"
    >
  >
) {
  await getOrCreateNotificationPreference(userId);

  const [updated] = await db
    .update(notificationPreference)
    .set({
      ...input,
      updatedAt: new Date(),
    })
    .where(eq(notificationPreference.userId, userId))
    .returning();

  return updated;
}

async function deactivatePushTokens(tokens: string[]) {
  if (tokens.length === 0) {
    return;
  }

  await db
    .update(notificationPushSubscription)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(inArray(notificationPushSubscription.token, tokens));
}

export async function sendPushFireAndForget({
  userIds,
  payload,
}: {
  userIds: string[];
  payload: PushNotificationPayload;
}) {
  if (!isFirebasePushConfigured()) {
    return {
      requested: 0,
      successCount: 0,
      failureCount: 0,
      invalidTokens: [],
      skipped: true,
    };
  }

  const preferences = await getNotificationPreferencesForUsers(userIds);
  const pushEnabledUserIds = userIds.filter(
    (userId) => preferences.get(userId)?.pushNotificationsEnabled !== false
  );
  const subscriptions = await getActivePushSubscriptionTokens(pushEnabledUserIds);
  const result = await sendPushToTokens({
    tokens: subscriptions.map((item) => item.token),
    payload,
  });

  await deactivatePushTokens(result.invalidTokens);

  logger.info("push notification dispatch completed", {
    requestedUsers: userIds.length,
    pushEnabledUsers: pushEnabledUserIds.length,
    activeTokens: subscriptions.length,
    successCount: result.successCount,
    failureCount: result.failureCount,
    invalidTokenCount: result.invalidTokens.length,
  });

  return {
    ...result,
    skipped: false,
  };
}

export async function queueNotificationForUsers({
  recipientUserIds,
  audiencePanel,
  audienceRole,
  deliveryChannel,
  payload,
  templateKey,
  relatedEntityType,
  relatedEntityId,
  broadcastId,
  createdByUser,
}: SendNotificationOptions) {
  const uniqueUserIds = [...new Set(recipientUserIds)];
  const preferences = await getNotificationPreferencesForUsers(uniqueUserIds);
  const shouldCreateDashboard = deliveryChannel === "DASHBOARD" || deliveryChannel === "BOTH";
  const shouldSendPush = deliveryChannel === "PUSH" || deliveryChannel === "BOTH";
  const createdAt = new Date();
  const dashboardUserIds = uniqueUserIds.filter(
    (userId) => preferences.get(userId)?.dashboardNotificationsEnabled !== false
  );
  const pushUserIds = uniqueUserIds.filter(
    (userId) => preferences.get(userId)?.pushNotificationsEnabled !== false
  );

  const dashboardRows = shouldCreateDashboard
    ? dashboardUserIds.length > 0
      ? await db
          .insert(notification)
          .values(
            dashboardUserIds.map((userId) => ({
              id: generateRandomId(),
              userId,
              audiencePanel,
              audienceRole,
              title: payload.title,
              body: payload.body,
              icon: payload.icon ?? DEFAULT_NOTIFICATION_ICON,
              image: payload.image ?? null,
              actionUrl: payload.actionUrl ?? null,
              tag: payload.tag ?? null,
              templateKey,
              deliveryChannel,
              dashboardStatus: "SENT" as const,
              pushStatus: shouldSendPush ? ("QUEUED" as const) : ("SKIPPED" as const),
              relatedEntityType,
              relatedEntityId,
              broadcastId,
              data: payload.data ?? {},
              createdByUser,
              sentAt: createdAt,
            }))
          )
          .returning()
      : []
    : [];

  publishRealtimeNotifications(dashboardRows);

  const pushSubscriptionCount = shouldSendPush
    ? await getActivePushSubscriptionTokens(pushUserIds).then((tokens) => tokens.length)
    : 0;

  if (shouldSendPush) {
    void sendPushFireAndForget({
      userIds: pushUserIds,
      payload: {
        icon: DEFAULT_NOTIFICATION_ICON,
        badge: DEFAULT_NOTIFICATION_BADGE,
        ...payload,
      },
    });
  }

  return {
    recipientCount: uniqueUserIds.length,
    dashboardNotificationCount: dashboardRows.length,
    pushSubscriptionCount,
  };
}

export function subscribeToUserNotifications(userId: string, send: RealtimeSend) {
  const subscribers = realtimeSubscribers.get(userId) ?? new Set<RealtimeSend>();
  subscribers.add(send);
  realtimeSubscribers.set(userId, subscribers);

  return () => {
    subscribers.delete(send);
    if (subscribers.size === 0) {
      realtimeSubscribers.delete(userId);
    }
  };
}

function publishRealtimeNotifications(rows: NotificationRecord[]) {
  for (const row of rows) {
    if (!row.userId) {
      continue;
    }

    const subscribers = realtimeSubscribers.get(row.userId);
    if (!subscribers) {
      continue;
    }

    for (const send of subscribers) {
      send(row);
    }
  }
}

export async function markNotificationRead(notificationId: string, userId: string) {
  const [updated] = await db
    .update(notification)
    .set({
      readAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(notification.id, notificationId), eq(notification.userId, userId)))
    .returning();

  return updated ?? null;
}

export async function archiveNotification(notificationId: string, userId: string) {
  const [updated] = await db
    .update(notification)
    .set({
      archivedAt: new Date(),
      readAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(notification.id, notificationId),
        eq(notification.userId, userId),
        isNull(notification.deletedAt)
      )
    )
    .returning();

  return updated ?? null;
}

export async function deleteNotification(notificationId: string, userId: string) {
  const [updated] = await db
    .update(notification)
    .set({
      deletedAt: new Date(),
      readAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(notification.id, notificationId), eq(notification.userId, userId)))
    .returning();

  return updated ?? null;
}

export async function markAllNotificationsRead(userId: string) {
  await db
    .update(notification)
    .set({
      readAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(notification.userId, userId),
        isNull(notification.readAt),
        isNull(notification.archivedAt),
        isNull(notification.deletedAt)
      )
    );
}

export async function countUnreadNotifications(userId: string) {
  const rows = await db
    .select({ id: notification.id })
    .from(notification)
    .where(
      and(
        eq(notification.userId, userId),
        isNull(notification.readAt),
        isNull(notification.archivedAt),
        isNull(notification.deletedAt)
      )
    );

  return rows.length;
}

export async function upsertPushSubscription({
  userId,
  token,
  deviceId,
  platform,
  browser,
  userAgent,
}: {
  userId: string;
  token: string;
  deviceId?: string | null;
  platform?: string | null;
  browser?: string | null;
  userAgent?: string | null;
}) {
  const now = new Date();
  const normalizedToken = token.trim();
  const normalizedDeviceId = deviceId?.trim() || null;
  const [subscription] = await db
    .insert(notificationPushSubscription)
    .values({
      id: generateRandomId(),
      userId,
      token: normalizedToken,
      deviceId: normalizedDeviceId,
      platform,
      browser,
      userAgent,
      isActive: true,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: notificationPushSubscription.token,
      set: {
        userId,
        deviceId: normalizedDeviceId,
        platform,
        browser,
        userAgent,
        isActive: true,
        lastSeenAt: now,
        updatedAt: now,
      },
    })
    .returning();

  if (normalizedDeviceId) {
    await db
      .update(notificationPushSubscription)
      .set({
        isActive: false,
        updatedAt: now,
      })
      .where(
        and(
          eq(notificationPushSubscription.userId, userId),
          eq(notificationPushSubscription.deviceId, normalizedDeviceId),
          ne(notificationPushSubscription.token, normalizedToken)
        )
      );
  }

  return subscription;
}

export async function unregisterPushSubscription(userId: string, token: string) {
  await db
    .update(notificationPushSubscription)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(notificationPushSubscription.userId, userId),
        eq(notificationPushSubscription.token, token)
      )
    );
}

export async function purgeExpiredDeletedNotifications(now = new Date()) {
  const purgeBefore = new Date(now.getTime() - NOTIFICATION_DELETE_PURGE_AFTER_MS);

  const deletedNotifications = await db
    .delete(notification)
    .where(and(isNotNull(notification.deletedAt), lte(notification.deletedAt, purgeBefore)))
    .returning({ id: notification.id });

  if (deletedNotifications.length > 0) {
    logger.info("expired deleted notifications purged", {
      count: deletedNotifications.length,
      notificationIds: deletedNotifications.map((item) => item.id),
    });
  }

  return deletedNotifications;
}

export async function purgeExpiredPushSubscriptions(now = new Date()) {
  const inactiveBefore = new Date(now.getTime() - PUSH_SUBSCRIPTION_INACTIVE_PURGE_AFTER_MS);
  const staleBefore = new Date(now.getTime() - PUSH_SUBSCRIPTION_STALE_PURGE_AFTER_MS);

  const deletedSubscriptions = await db
    .delete(notificationPushSubscription)
    .where(
      or(
        and(
          eq(notificationPushSubscription.isActive, false),
          lte(notificationPushSubscription.updatedAt, inactiveBefore)
        ),
        lte(notificationPushSubscription.lastSeenAt, staleBefore)
      )
    )
    .returning({
      id: notificationPushSubscription.id,
      userId: notificationPushSubscription.userId,
      deviceId: notificationPushSubscription.deviceId,
    });

  if (deletedSubscriptions.length > 0) {
    logger.info("expired push subscriptions purged", {
      count: deletedSubscriptions.length,
      subscriptionIds: deletedSubscriptions.map((item) => item.id),
    });
  }

  return deletedSubscriptions;
}

export async function purgeExpiredNotificationTriggerExecutions(now = new Date()) {
  const executedBefore = new Date(now.getTime() - NOTIFICATION_TRIGGER_EXECUTION_PURGE_AFTER_MS);
  const deletedExecutions = await db
    .delete(notificationTriggerExecution)
    .where(lte(notificationTriggerExecution.executedAt, executedBefore))
    .returning({
      id: notificationTriggerExecution.id,
      triggerId: notificationTriggerExecution.triggerId,
    });

  if (deletedExecutions.length > 0) {
    logger.info("expired notification trigger executions purged", {
      count: deletedExecutions.length,
      executionIds: deletedExecutions.map((item) => item.id),
    });
  }

  return deletedExecutions;
}

function runNotificationMaintenanceCron() {
  if (notificationDeletePurgeCronPromise) {
    return;
  }

  notificationDeletePurgeCronPromise = Promise.all([
    purgeExpiredDeletedNotifications(),
    purgeExpiredPushSubscriptions(),
    purgeExpiredNotificationTriggerExecutions(),
  ])
    .then(() => undefined)
    .catch((error) => {
      logger.error("notification maintenance cron failed", {
        error: error instanceof Error ? error.stack : error,
      });
    })
    .finally(() => {
      notificationDeletePurgeCronPromise = null;
    });
}

export function startNotificationDeletePurgeCron() {
  if (notificationDeletePurgeCronStarted) {
    return;
  }

  notificationDeletePurgeCronStarted = true;

  const initialTimer = setTimeout(
    runNotificationMaintenanceCron,
    NOTIFICATION_DELETE_PURGE_INITIAL_DELAY_MS
  );
  initialTimer.unref?.();

  const intervalTimer = setInterval(
    runNotificationMaintenanceCron,
    NOTIFICATION_DELETE_PURGE_INTERVAL_MS
  );
  intervalTimer.unref?.();
}
