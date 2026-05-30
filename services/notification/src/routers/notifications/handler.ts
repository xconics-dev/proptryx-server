import type { AppBindings } from "@/types/app";
import { upgradeWebSocket } from "@hono/node-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import { env } from "@/config/env";
import {
  db,
  getRbacResourceMetadata,
  notificationTemplate,
  notificationTrigger,
  notificationTriggerExecution,
} from "@proptryx/database";
import { sendPropertyPublishedNotificationEmails } from "@proptryx/notification";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@proptryx/utils";
import { and, eq, inArray } from "drizzle-orm";
import {
  archiveMyNotification,
  broadcastProptryxNotification,
  createNotificationTemplate,
  createNotificationTrigger,
  deleteNotificationTemplate as deleteNotificationTemplateRoute,
  deleteNotificationTrigger,
  deleteMyNotification,
  getNotificationTrigger,
  getMyUnreadNotificationCount,
  getNotificationTemplate,
  getNotificationPreferences,
  listNotificationTriggerOptions,
  listNotificationTriggerExecutions,
  listNotificationTriggers,
  listMyNotifications,
  listNotificationTemplates,
  markAllMyNotificationsRead,
  markMyNotificationRead,
  notifyPropertyPublished,
  notifyResourceEvent,
  permanentlyDeleteNotificationTrigger,
  registerPushSubscription,
  sendProptryxNotification,
  streamMyNotifications,
  testNotificationTrigger,
  testMyPushNotification,
  updateNotificationTemplate,
  updateNotificationTrigger,
  updateNotificationPreferences,
  unregisterPushSubscriptionRoute,
  authMiddleware,
  notificationRateLimit,
} from "./openapi.route";
import {
  fetchNotificationList,
  fetchNotificationTemplateList,
  fetchNotificationTriggerExecutionList,
  fetchNotificationTriggerList,
} from "./list";
import { SYSTEM_NOTIFICATION_TEMPLATE_KEYS } from "./constants";
import {
  archiveNotification,
  countUnreadNotifications,
  deleteNotification,
  ensureNotificationTemplatesSeeded,
  getNotificationPreferencesForUsers,
  getOrCreateNotificationPreference,
  markAllNotificationsRead,
  markNotificationRead,
  queueNotificationForUsers,
  resolveNotificationPayload,
  resolveNotificationRecipients,
  deleteNotificationTemplate as removeNotificationTemplate,
  sendPushFireAndForget,
  subscribeToUserNotifications,
  unregisterPushSubscription,
  updateNotificationPreference,
  upsertPushSubscription,
} from "./utils";
import type { notificationPreference } from "@proptryx/database";

export const notificationGroup = new OpenAPIHono<AppBindings>();
export const proptryxNotificationGroup = new OpenAPIHono<AppBindings>();
export const internalNotificationGroup = new OpenAPIHono<AppBindings>();

const DOUBLE_BRACE_VARIABLE_PATTERN = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;
const SINGLE_BRACE_VARIABLE_PATTERN = /\{([a-zA-Z0-9_.-]+)\}/g;
const DEFAULT_NOTIFICATION_ICON = "/logo/logo.png";
const READ_ONLY_TRIGGER_ACTIONS = new Set(["get", "getAll", "read", "archive"]);
const COMMON_TRIGGER_VARIABLES = [
  "id",
  "name",
  "title",
  "actorUserId",
  "actorName",
  "sourceService",
  "resource",
  "operation",
  "phase",
  "createdAt",
  "updatedAt",
] as const;
const RESOURCE_TRIGGER_VARIABLES: Record<string, string[]> = {
  property: ["propertyId", "propertyName", "organizationId", "organizationName", "publishedAt"],
  properties: ["propertyId", "propertyName", "organizationId", "organizationName", "publishedAt"],
  meeting: ["meetingId", "propertyId", "organizationId", "scheduledAt"],
  meetings: ["meetingId", "propertyId", "organizationId", "scheduledAt"],
  member: ["memberId", "userId", "organizationId", "role"],
  members: ["memberId", "userId", "organizationId", "role"],
  company: ["organizationId", "organizationName", "companyName"],
  organization: ["organizationId", "organizationName", "companyName"],
  region: ["regionId", "regionName"],
  zone: ["zoneId", "zoneName", "regionId", "regionName"],
  notification: ["notificationId", "userId"],
  notification_trigger: ["notificationTriggerId", "notificationTriggerName"],
  notification_template: ["notificationTemplateId", "notificationTemplateName"],
  user: ["userId", "userName", "email"],
  users: ["userId", "userName", "email"],
};

function toVariableStem(value: string) {
  const parts = value
    .split(/[^a-zA-Z0-9]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "resource";
  }

  return parts
    .map((part, index) =>
      index === 0 ? part.charAt(0).toLowerCase() + part.slice(1) : toTitleCase(part)
    )
    .join("");
}

function getSingularResource(value: string) {
  if (value.endsWith("ies")) {
    return `${value.slice(0, -3)}y`;
  }

  if (value.endsWith("s")) {
    return value.slice(0, -1);
  }

  return value;
}

function buildTriggerVariableNames(resource: string) {
  const singular = getSingularResource(resource);
  const resourceStem = toVariableStem(resource);
  const singularStem = toVariableStem(singular);

  return [
    ...new Set([
      ...COMMON_TRIGGER_VARIABLES,
      `${singularStem}Id`,
      `${singularStem}Name`,
      `${resourceStem}Id`,
      `${resourceStem}Name`,
      ...(RESOURCE_TRIGGER_VARIABLES[resource] ?? []),
      ...(RESOURCE_TRIGGER_VARIABLES[singular] ?? []),
    ]),
  ].sort((left, right) => left.localeCompare(right));
}

function toTitleCase(value: string) {
  return value
    .split(/[_-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getTriggerSourceService(scope: "proptryx" | "company", resource: string) {
  if (scope === "company") {
    return "company";
  }

  if (
    resource === "property" ||
    resource === "meeting" ||
    resource === "faq" ||
    resource === "testimonial" ||
    resource === "region" ||
    resource === "zone"
  ) {
    return "kernel";
  }

  return "auth";
}

function isTriggerableOperation(operation: string) {
  return !READ_ONLY_TRIGGER_ACTIONS.has(operation);
}

function buildNotificationTriggerOptions() {
  const byKey = new Map<
    string,
    {
      key: string;
      label: string;
      sourceService: string;
      resource: string;
      resourceLabel: string;
      operation: string;
      operationLabel: string;
      phase: "before" | "after";
      variables: string[];
    }
  >();

  for (const scope of ["proptryx", "company"] as const) {
    for (const resourceMetadata of getRbacResourceMetadata(scope)) {
      for (const operation of resourceMetadata.actions) {
        if (!isTriggerableOperation(operation)) {
          continue;
        }

        for (const phase of ["before", "after"] as const) {
          const sourceService = getTriggerSourceService(scope, resourceMetadata.resource);
          const key = `${sourceService}:${resourceMetadata.resource}:${operation}:${phase}`;
          const resourceLabel = resourceMetadata.label;
          const operationLabel = toTitleCase(operation);
          byKey.set(key, {
            key,
            label: `${resourceLabel} ${operationLabel} (${phase})`,
            sourceService,
            resource: resourceMetadata.resource,
            resourceLabel,
            operation,
            operationLabel,
            phase,
            variables: buildTriggerVariableNames(resourceMetadata.resource),
          });
        }
      }
    }
  }

  return [...byKey.values()].sort((left, right) => left.label.localeCompare(right.label));
}

async function getActiveNotificationTriggers(input: {
  sourceService: string;
  resource: string;
  operation: string;
  phase: "before" | "after";
}) {
  const resources = getTriggerResourceAliases(input.resource);

  return db
    .select()
    .from(notificationTrigger)
    .where(
      and(
        eq(notificationTrigger.sourceService, input.sourceService),
        inArray(notificationTrigger.resource, resources),
        eq(notificationTrigger.operation, input.operation),
        eq(notificationTrigger.phase, input.phase),
        eq(notificationTrigger.isActive, true),
        eq(notificationTrigger.isDeleted, false)
      )
    );
}

function getTriggerResourceAliases(resource: string) {
  const aliases = new Set([resource]);

  if (resource.endsWith("ies")) {
    aliases.add(`${resource.slice(0, -3)}y`);
  } else if (resource.endsWith("s")) {
    aliases.add(resource.slice(0, -1));
  } else if (resource.endsWith("y")) {
    aliases.add(`${resource.slice(0, -1)}ies`);
  } else {
    aliases.add(`${resource}s`);
  }

  return [...aliases].filter(Boolean);
}

function renderTriggerValue(value: string | null | undefined, variables: Record<string, string>) {
  if (!value) {
    return value;
  }

  return value
    .replace(DOUBLE_BRACE_VARIABLE_PATTERN, (match, key) => variables[key] ?? match)
    .replace(SINGLE_BRACE_VARIABLE_PATTERN, (match, key) => variables[key] ?? match);
}

function renderTriggerDataValue(
  value: unknown,
  variables: Record<string, string>
): string | number | boolean | null {
  if (typeof value === "string") {
    return renderTriggerValue(value, variables) ?? "";
  }

  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return value;
  }

  if (value === undefined) {
    return null;
  }

  return JSON.stringify(value);
}

function renderTriggerData(
  data: Record<string, unknown> | null | undefined,
  variables: Record<string, string>
) {
  return Object.fromEntries(
    Object.entries(data ?? {}).map(([key, value]) => [
      key,
      renderTriggerDataValue(value, variables),
    ])
  );
}

function normalizeTriggerVariables(variables: Record<string, unknown> = {}) {
  return Object.fromEntries(
    Object.entries(variables).map(([key, value]) => [key, value == null ? "" : String(value)])
  );
}

function slugifyTriggerPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

async function createUniqueTriggerKey(baseKey: string, name: string, excludeId?: string) {
  const base = [baseKey, slugifyTriggerPart(name)].filter(Boolean).join(":").slice(0, 150);

  for (let index = 0; index < 50; index += 1) {
    const candidate = index === 0 ? base : `${base}:${index + 1}`;
    const existing = await db
      .select({ id: notificationTrigger.id })
      .from(notificationTrigger)
      .where(eq(notificationTrigger.key, candidate))
      .limit(1)
      .then((rows) => rows[0]);

    if (!existing || existing.id === excludeId) {
      return candidate;
    }
  }

  return `${base}:${generateRandomId()}`.slice(0, 180);
}

function triggerConditionsMatch(
  trigger: typeof notificationTrigger.$inferSelect,
  eventData: Record<string, unknown> | undefined,
  variables: Record<string, string>
) {
  const conditions = Object.entries(trigger.conditions ?? {});

  if (conditions.length === 0) {
    return true;
  }

  return conditions.every(([key, expected]) => {
    const actual = variables[key] ?? eventData?.[key];

    if (Array.isArray(expected)) {
      return expected.map(String).includes(String(actual ?? ""));
    }

    if (expected && typeof expected === "object") {
      const condition = expected as {
        equals?: unknown;
        notEquals?: unknown;
        includes?: unknown[];
      };

      if ("equals" in condition) {
        return String(actual ?? "") === String(condition.equals ?? "");
      }

      if ("notEquals" in condition) {
        return String(actual ?? "") !== String(condition.notEquals ?? "");
      }

      if (Array.isArray(condition.includes)) {
        return condition.includes.map(String).includes(String(actual ?? ""));
      }
    }

    return String(actual ?? "") === String(expected ?? "");
  });
}

function buildDefaultTriggerTestVariables(trigger: typeof notificationTrigger.$inferSelect) {
  const entityId = `test-${trigger.resource}-id`;
  const entityName = `Demo ${toTitleCase(trigger.resource)}`;

  return {
    id: entityId,
    [`${trigger.resource}Id`]: entityId,
    [`${trigger.resource}Name`]: entityName,
    name: entityName,
    title: entityName,
    actorUserId: "current-user",
    actorName: "Current User",
    operation: trigger.operation,
    resource: trigger.resource,
    phase: trigger.phase,
    sourceService: trigger.sourceService,
    updatedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
}

async function resolveTriggerEventPayload({
  data,
  defaultActionUrl,
  defaultBody,
  defaultIcon,
  defaultImage,
  defaultTag,
  defaultTitle,
  relatedEntityId,
  relatedEntityType,
  trigger,
  variables,
}: {
  trigger: typeof notificationTrigger.$inferSelect;
  variables: Record<string, string>;
  data?: Record<string, unknown>;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  defaultTitle?: string | null;
  defaultBody?: string | null;
  defaultActionUrl?: string | null;
  defaultTag?: string | null;
  defaultIcon?: string | null;
  defaultImage?: string | null;
}) {
  const payloadData = {
    ...renderTriggerData(data, variables),
    ...renderTriggerData(trigger.data, variables),
    triggerId: trigger.id,
    triggerKey: trigger.key,
    sourceService: trigger.sourceService,
    resource: trigger.resource,
    operation: trigger.operation,
    phase: trigger.phase,
    entityType: relatedEntityType ?? trigger.resource,
    entityId: relatedEntityId ?? variables.id ?? null,
  };

  if (trigger.templateKey) {
    return resolveNotificationPayload({
      template: {
        templateKey: trigger.templateKey,
        variables,
        overrides: {
          icon: renderTriggerValue(trigger.icon, variables) ?? defaultIcon,
          image: renderTriggerValue(trigger.image, variables) ?? defaultImage,
          actionUrl: renderTriggerValue(trigger.actionUrl, variables) ?? defaultActionUrl,
          tag: renderTriggerValue(trigger.tag, variables) ?? defaultTag,
          data: payloadData,
        },
      },
    });
  }

  return resolveNotificationPayload({
    custom: {
      title:
        renderTriggerValue(trigger.title, variables) ?? defaultTitle ?? `${trigger.name} executed`,
      body:
        renderTriggerValue(trigger.body, variables) ??
        defaultBody ??
        `${trigger.resource} ${trigger.operation} completed.`,
      icon: renderTriggerValue(trigger.icon, variables) ?? defaultIcon,
      image: renderTriggerValue(trigger.image, variables) ?? defaultImage,
      actionUrl: renderTriggerValue(trigger.actionUrl, variables) ?? defaultActionUrl,
      tag:
        renderTriggerValue(trigger.tag, variables) ??
        defaultTag ??
        `${trigger.resource}:${relatedEntityId ?? variables.id ?? "event"}:${trigger.operation}`,
      priority: "high",
      data: payloadData,
    },
  });
}

async function recordNotificationTriggerExecution(input: {
  trigger: typeof notificationTrigger.$inferSelect;
  status: "success" | "failed";
  recipientCount?: number;
  dashboardNotificationCount?: number;
  pushSubscriptionCount?: number;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  error?: string | null;
  data?: Record<string, unknown>;
}) {
  const [execution] = await db
    .insert(notificationTriggerExecution)
    .values({
      id: generateRandomId(),
      triggerId: input.trigger.id,
      sourceService: input.trigger.sourceService,
      resource: input.trigger.resource,
      operation: input.trigger.operation,
      phase: input.trigger.phase,
      status: input.status,
      recipientCount: input.recipientCount ?? 0,
      dashboardNotificationCount: input.dashboardNotificationCount ?? 0,
      pushSubscriptionCount: input.pushSubscriptionCount ?? 0,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null,
      error: input.error ?? null,
      data: input.data ?? {},
    })
    .returning();

  return execution;
}

function isInternalRequestAuthorized(secret?: string) {
  return secret === env.BETTER_AUTH_SECRET;
}

notificationGroup.get(
  "/me/socket",
  notificationRateLimit,
  authMiddleware,
  upgradeWebSocket((c) => {
    const { user } = getBetterAuthContext(c);
    const userId = user?.id ?? "__none__";
    let unsubscribe: (() => void) | undefined;

    return {
      onOpen(_event, ws) {
        ws.send(JSON.stringify({ event: "ready", data: { ok: true } }));
        unsubscribe = subscribeToUserNotifications(userId, (notificationItem) => {
          ws.send(JSON.stringify({ event: "notification", data: notificationItem }));
        });
      },
      onClose() {
        unsubscribe?.();
      },
      onError() {
        unsubscribe?.();
      },
    };
  })
);

registerOpenApiRoute(notificationGroup, listMyNotifications, async (c) => {
  const query = c.req.valid("query");
  const { user } = getBetterAuthContext(c);

  const response = await fetchNotificationList({
    ...query,
    userId: user?.id ?? "__none__",
  });

  return c.json(createSuccessResponse(response), 200);
});

registerOpenApiRoute(notificationGroup, getMyUnreadNotificationCount, async (c) => {
  const { user } = getBetterAuthContext(c);
  const count = await countUnreadNotifications(user?.id ?? "__none__");

  return c.json(createSuccessResponse({ count }), 200);
});

registerOpenApiRoute(notificationGroup, streamMyNotifications, async (c) => {
  const { user } = getBetterAuthContext(c);
  const userId = user?.id ?? "__none__";
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | undefined;
  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      send("ready", { ok: true });
      unsubscribe = subscribeToUserNotifications(userId, (notificationItem) => {
        send("notification", notificationItem);
      });
    },
    cancel() {
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream",
      "x-accel-buffering": "no",
    },
  });
});

registerOpenApiRoute(notificationGroup, markMyNotificationRead, async (c) => {
  const { id } = c.req.valid("param");
  const { user } = getBetterAuthContext(c);
  const updated = await markNotificationRead(id, user?.id ?? "__none__");

  if (!updated) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Notification not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(updated), 200);
});

registerOpenApiRoute(notificationGroup, archiveMyNotification, async (c) => {
  const { id } = c.req.valid("param");
  const { user } = getBetterAuthContext(c);
  const updated = await archiveNotification(id, user?.id ?? "__none__");

  if (!updated) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Notification not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(updated), 200);
});

registerOpenApiRoute(notificationGroup, deleteMyNotification, async (c) => {
  const { id } = c.req.valid("param");
  const { user } = getBetterAuthContext(c);
  const updated = await deleteNotification(id, user?.id ?? "__none__");

  if (!updated) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Notification not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(updated), 200);
});

registerOpenApiRoute(notificationGroup, markAllMyNotificationsRead, async (c) => {
  const { user } = getBetterAuthContext(c);
  await markAllNotificationsRead(user?.id ?? "__none__");

  return c.json(createSuccessResponse({ message: "Notifications marked as read" }), 200);
});

registerOpenApiRoute(notificationGroup, registerPushSubscription, async (c) => {
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  const subscription = await upsertPushSubscription({
    userId: user?.id ?? "__none__",
    ...body,
  });

  return c.json(createSuccessResponse(subscription), 200);
});

registerOpenApiRoute(notificationGroup, testMyPushNotification, async (c) => {
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  const userId = user?.id ?? "__none__";
  const { deliveryChannel, ...payloadInput } = body;
  const shouldCreateDashboard = deliveryChannel === "DASHBOARD" || deliveryChannel === "BOTH";
  const shouldSendPush = deliveryChannel === "PUSH" || deliveryChannel === "BOTH";
  const payload = {
    icon: "/logo/logo.png",
    badge: "/logo/logo.png",
    priority: "high" as const,
    ...payloadInput,
    data: {
      type: "manual-notification-test",
      deliveryChannel,
      ...(payloadInput.data ?? {}),
    },
  };
  const dashboardResult =
    shouldCreateDashboard && user?.id
      ? await queueNotificationForUsers({
          recipientUserIds: [user.id],
          audiencePanel: "ALL",
          audienceRole: null,
          deliveryChannel: "DASHBOARD",
          payload,
          templateKey: null,
          relatedEntityType: payloadInput.relatedEntityType ?? "notification",
          relatedEntityId: payloadInput.relatedEntityId ?? user.id,
          createdByUser: user.id,
        })
      : {
          recipientCount: user?.id ? 1 : 0,
          dashboardNotificationCount: 0,
          pushSubscriptionCount: 0,
        };
  const pushResult = shouldSendPush
    ? await sendPushFireAndForget({
        userIds: [userId],
        payload,
      })
    : {
        requested: 0,
        successCount: 0,
        failureCount: 0,
        invalidTokens: [],
        skipped: false,
      };

  return c.json(
    createSuccessResponse({
      message:
        shouldCreateDashboard && dashboardResult.dashboardNotificationCount > 0
          ? shouldSendPush && pushResult.successCount > 0
            ? "Test dashboard notification queued and FCM push sent"
            : "Test dashboard notification queued"
          : pushResult.skipped
            ? "Firebase Cloud Messaging is not configured on the server"
            : shouldSendPush && pushResult.successCount > 0
              ? "Test push sent through Firebase Cloud Messaging"
              : "No active notification channel accepted the test notification",
      dashboardNotificationCount: dashboardResult.dashboardNotificationCount,
      pushSubscriptionCount: pushResult.requested,
      requested: pushResult.requested,
      successCount: pushResult.successCount,
      failureCount: pushResult.failureCount,
      invalidTokens: pushResult.invalidTokens,
      skipped: pushResult.skipped,
    }),
    202
  );
});

registerOpenApiRoute(notificationGroup, getNotificationPreferences, async (c) => {
  const { user } = getBetterAuthContext(c);
  const preference = await getOrCreateNotificationPreference(user?.id ?? "__none__");

  return c.json(createSuccessResponse(preference), 200);
});

registerOpenApiRoute(notificationGroup, updateNotificationPreferences, async (c) => {
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  const preferenceUpdate: Partial<
    Pick<
      typeof notificationPreference.$inferSelect,
      | "emailNotificationsEnabled"
      | "dashboardNotificationsEnabled"
      | "pushNotificationsEnabled"
      | "browserPermissionPromptedAt"
      | "browserPermissionStatus"
    >
  > = {};

  if (body.emailNotificationsEnabled !== undefined) {
    preferenceUpdate.emailNotificationsEnabled = body.emailNotificationsEnabled;
  }
  if (body.dashboardNotificationsEnabled !== undefined) {
    preferenceUpdate.dashboardNotificationsEnabled = body.dashboardNotificationsEnabled;
  }
  if (body.pushNotificationsEnabled !== undefined) {
    preferenceUpdate.pushNotificationsEnabled = body.pushNotificationsEnabled;
  }
  if (body.browserPermissionStatus !== undefined) {
    preferenceUpdate.browserPermissionStatus = body.browserPermissionStatus;
  }
  if (body.browserPermissionPromptedAt !== undefined) {
    preferenceUpdate.browserPermissionPromptedAt = body.browserPermissionPromptedAt
      ? new Date(body.browserPermissionPromptedAt)
      : null;
  }

  const preference = await updateNotificationPreference(user?.id ?? "__none__", preferenceUpdate);

  return c.json(createSuccessResponse(preference), 200);
});

registerOpenApiRoute(notificationGroup, unregisterPushSubscriptionRoute, async (c) => {
  const { token } = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  await unregisterPushSubscription(user?.id ?? "__none__", token);

  return c.json(createSuccessResponse({ message: "Push subscription unregistered" }), 200);
});

registerOpenApiRoute(proptryxNotificationGroup, listNotificationTemplates, async (c) => {
  const query = c.req.valid("query");
  await ensureNotificationTemplatesSeeded();

  const templates = await fetchNotificationTemplateList(query);

  return c.json(createSuccessResponse(templates), 200);
});

registerOpenApiRoute(proptryxNotificationGroup, getNotificationTemplate, async (c) => {
  const { id } = c.req.valid("param");
  await ensureNotificationTemplatesSeeded();

  const template = await db
    .select()
    .from(notificationTemplate)
    .where(eq(notificationTemplate.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!template) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Notification template not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(template), 200);
});

registerOpenApiRoute(proptryxNotificationGroup, createNotificationTemplate, async (c) => {
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);

  if (SYSTEM_NOTIFICATION_TEMPLATE_KEYS.includes(body.key as never)) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: "System notification templates cannot be created or modified",
      }),
      400
    );
  }

  const [template] = await db
    .insert(notificationTemplate)
    .values({
      id: generateRandomId(),
      key: body.key,
      name: body.name,
      title: body.title,
      body: body.body,
      icon: body.icon ?? DEFAULT_NOTIFICATION_ICON,
      image: body.image ?? null,
      actionUrl: body.actionUrl ?? null,
      data: body.data ?? {},
      isActive: body.isActive ?? true,
      createdByUser: user?.id ?? null,
      updatedByUser: user?.id ?? null,
    })
    .returning();

  return c.json(createSuccessResponse(template), 200);
});

registerOpenApiRoute(proptryxNotificationGroup, updateNotificationTemplate, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  const existing = await db
    .select()
    .from(notificationTemplate)
    .where(eq(notificationTemplate.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!existing) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Notification template not found",
      }),
      404
    );
  }

  if (SYSTEM_NOTIFICATION_TEMPLATE_KEYS.includes(existing.key as never)) {
    return c.json(
      createErrorResponse({
        error: "Bad Request",
        message: "System notification templates cannot be modified",
      }),
      400
    );
  }

  const [template] = await db
    .update(notificationTemplate)
    .set({
      ...body,
      updatedByUser: user?.id ?? null,
      updatedAt: new Date(),
    })
    .where(eq(notificationTemplate.id, id))
    .returning();

  if (!template) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Notification template not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(template), 200);
});

registerOpenApiRoute(proptryxNotificationGroup, deleteNotificationTemplateRoute, async (c) => {
  const { id } = c.req.valid("param");

  try {
    const deleted = await removeNotificationTemplate(id);

    if (!deleted) {
      return c.json(
        createErrorResponse({
          error: "Not Found",
          message: "Notification template not found",
        }),
        404
      );
    }

    return c.json(createSuccessResponse(deleted), 200);
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "System notification templates cannot be deleted"
    ) {
      return c.json(
        createErrorResponse({
          error: "Forbidden",
          message: error.message,
        }),
        403
      );
    }

    throw error;
  }
});

registerOpenApiRoute(proptryxNotificationGroup, listNotificationTriggerOptions, async (c) => {
  return c.json(createSuccessResponse({ options: buildNotificationTriggerOptions() }), 200);
});

registerOpenApiRoute(proptryxNotificationGroup, listNotificationTriggers, async (c) => {
  const query = c.req.valid("query");
  const triggers = await fetchNotificationTriggerList(query);

  return c.json(createSuccessResponse(triggers), 200);
});

registerOpenApiRoute(proptryxNotificationGroup, listNotificationTriggerExecutions, async (c) => {
  const { id } = c.req.valid("param");
  const query = c.req.valid("query");
  const executions = await fetchNotificationTriggerExecutionList({
    ...query,
    triggerId: id,
  });

  return c.json(createSuccessResponse(executions), 200);
});

registerOpenApiRoute(proptryxNotificationGroup, getNotificationTrigger, async (c) => {
  const { id } = c.req.valid("param");
  const trigger = await db
    .select()
    .from(notificationTrigger)
    .where(eq(notificationTrigger.id, id))
    .limit(1)
    .then((rows) => rows[0]);

  if (!trigger) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Notification trigger not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(trigger), 200);
});

registerOpenApiRoute(proptryxNotificationGroup, createNotificationTrigger, async (c) => {
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  const key = await createUniqueTriggerKey(body.key, body.name);
  const [trigger] = await db
    .insert(notificationTrigger)
    .values({
      id: generateRandomId(),
      key,
      name: body.name,
      description: body.description ?? null,
      sourceService: body.sourceService,
      resource: body.resource,
      operation: body.operation,
      phase: body.phase ?? "after",
      deliveryChannel: body.deliveryChannel ?? "BOTH",
      audiencePanel: body.audiencePanel ?? "ALL",
      audienceRole: body.audienceRole ?? null,
      audienceRoles: body.audienceRoles ?? [],
      recipientStrategy: body.recipientStrategy ?? "resource_owner",
      templateKey: body.templateKey ?? null,
      title: body.title ?? null,
      body: body.body ?? null,
      icon: body.icon ?? DEFAULT_NOTIFICATION_ICON,
      image: body.image ?? null,
      actionUrl: body.actionUrl ?? null,
      tag: body.tag ?? null,
      data: body.data ?? {},
      conditions: body.conditions ?? {},
      isActive: body.isActive ?? true,
      createdByUser: user?.id ?? null,
      updatedByUser: user?.id ?? null,
    })
    .returning();

  return c.json(createSuccessResponse(trigger), 200);
});

registerOpenApiRoute(proptryxNotificationGroup, updateNotificationTrigger, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  const nextKey =
    body.key && body.name ? await createUniqueTriggerKey(body.key, body.name, id) : undefined;
  const [trigger] = await db
    .update(notificationTrigger)
    .set({
      ...body,
      key: nextKey,
      description: body.description === undefined ? undefined : (body.description ?? null),
      audienceRole: body.audienceRole === undefined ? undefined : (body.audienceRole ?? null),
      audienceRoles: body.audienceRoles === undefined ? undefined : (body.audienceRoles ?? []),
      templateKey: body.templateKey === undefined ? undefined : (body.templateKey ?? null),
      title: body.title === undefined ? undefined : (body.title ?? null),
      body: body.body === undefined ? undefined : (body.body ?? null),
      icon: body.icon === undefined ? undefined : (body.icon ?? DEFAULT_NOTIFICATION_ICON),
      image: body.image === undefined ? undefined : (body.image ?? null),
      actionUrl: body.actionUrl === undefined ? undefined : (body.actionUrl ?? null),
      tag: body.tag === undefined ? undefined : (body.tag ?? null),
      data: body.data ?? undefined,
      conditions: body.conditions ?? undefined,
      updatedByUser: user?.id ?? null,
      updatedAt: new Date(),
    })
    .where(eq(notificationTrigger.id, id))
    .returning();

  if (!trigger) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Notification trigger not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(trigger), 200);
});

registerOpenApiRoute(proptryxNotificationGroup, deleteNotificationTrigger, async (c) => {
  const { id } = c.req.valid("param");
  const { user } = getBetterAuthContext(c);
  const [trigger] = await db
    .update(notificationTrigger)
    .set({
      isActive: false,
      isDeleted: true,
      deletedAt: new Date(),
      deletedByUser: user?.id ?? null,
      updatedByUser: user?.id ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(notificationTrigger.id, id), eq(notificationTrigger.isDeleted, false)))
    .returning();

  if (!trigger) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Notification trigger not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(trigger), 200);
});

registerOpenApiRoute(proptryxNotificationGroup, permanentlyDeleteNotificationTrigger, async (c) => {
  const { id } = c.req.valid("param");
  const [trigger] = await db
    .delete(notificationTrigger)
    .where(eq(notificationTrigger.id, id))
    .returning();

  if (!trigger) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Notification trigger not found",
      }),
      404
    );
  }

  return c.json(createSuccessResponse(trigger), 200);
});

registerOpenApiRoute(proptryxNotificationGroup, testNotificationTrigger, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  const trigger = await db
    .select()
    .from(notificationTrigger)
    .where(and(eq(notificationTrigger.id, id), eq(notificationTrigger.isDeleted, false)))
    .limit(1)
    .then((rows) => rows[0]);

  if (!trigger) {
    return c.json(
      createErrorResponse({
        error: "Not Found",
        message: "Notification trigger not found",
      }),
      404
    );
  }

  const rawVariables = {
    ...buildDefaultTriggerTestVariables(trigger),
    ...(body.variables ?? {}),
  };
  const variables = normalizeTriggerVariables(rawVariables);
  const relatedEntityType = body.relatedEntityType ?? trigger.resource;
  const relatedEntityId = body.relatedEntityId ?? variables.id;
  const resolvedTriggerPayload = await resolveTriggerEventPayload({
    trigger,
    variables,
    data: {
      type: "trigger-test",
      ...(body.data ?? {}),
    },
    relatedEntityType,
    relatedEntityId,
    defaultTitle: `${trigger.name} test`,
    defaultBody: `Test execution for ${trigger.resource} ${trigger.operation}.`,
    defaultActionUrl: null,
    defaultTag: `trigger:${trigger.id}:test`,
  });

  let result: {
    recipientCount: number;
    dashboardNotificationCount: number;
    pushSubscriptionCount: number;
  };

  try {
    result = user?.id
      ? await queueNotificationForUsers({
          recipientUserIds: [user.id],
          audiencePanel: trigger.audiencePanel,
          audienceRole: trigger.audienceRoles.length
            ? trigger.audienceRoles.join(",")
            : trigger.audienceRole,
          deliveryChannel: trigger.deliveryChannel,
          payload: resolvedTriggerPayload.payload,
          templateKey: resolvedTriggerPayload.templateKey,
          relatedEntityType,
          relatedEntityId,
          createdByUser: user.id,
        })
      : {
          recipientCount: 0,
          dashboardNotificationCount: 0,
          pushSubscriptionCount: 0,
        };

    await recordNotificationTriggerExecution({
      trigger,
      status: "success",
      recipientCount: result.recipientCount,
      dashboardNotificationCount: result.dashboardNotificationCount,
      pushSubscriptionCount: result.pushSubscriptionCount,
      relatedEntityType,
      relatedEntityId,
      data: {
        ...rawVariables,
        test: true,
      },
    });
  } catch (error) {
    await recordNotificationTriggerExecution({
      trigger,
      status: "failed",
      relatedEntityType,
      relatedEntityId,
      error: error instanceof Error ? error.message : "Unknown trigger test execution error",
      data: {
        ...rawVariables,
        test: true,
      },
    });

    throw error;
  }

  return c.json(
    createSuccessResponse({
      broadcastId: null,
      ...result,
      message: "Notification trigger test executed",
      renderedTitle: resolvedTriggerPayload.payload.title,
      renderedBody: resolvedTriggerPayload.payload.body,
      renderedActionUrl: resolvedTriggerPayload.payload.actionUrl ?? null,
      renderedTag: resolvedTriggerPayload.payload.tag ?? null,
    }),
    202
  );
});

registerOpenApiRoute(proptryxNotificationGroup, sendProptryxNotification, async (c) => {
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  const { payload, templateKey } = await resolveNotificationPayload(body);
  const recipients = await resolveNotificationRecipients({
    recipientUserIds: body.recipientUserIds,
    organizationId: body.organizationId,
    audiencePanel: body.audiencePanel,
    audienceRole: body.audienceRole,
    audienceRoles: body.audienceRoles,
  });

  const result = await queueNotificationForUsers({
    recipientUserIds: recipients.map((recipient) => recipient.id),
    audiencePanel: body.audiencePanel,
    audienceRole: body.audienceRoles?.join(",") ?? body.audienceRole,
    deliveryChannel: body.deliveryChannel,
    payload,
    templateKey,
    relatedEntityType:
      body.custom?.relatedEntityType ?? body.template?.overrides?.relatedEntityType,
    relatedEntityId: body.custom?.relatedEntityId ?? body.template?.overrides?.relatedEntityId,
    createdByUser: user?.id ?? null,
  });

  return c.json(
    createSuccessResponse({
      broadcastId: null,
      ...result,
      message: "Notification queued",
    }),
    202
  );
});

registerOpenApiRoute(proptryxNotificationGroup, broadcastProptryxNotification, async (c) => {
  const body = c.req.valid("json");
  const { user } = getBetterAuthContext(c);
  const broadcastId = generateRandomId();
  const { payload, templateKey } = await resolveNotificationPayload(body);
  const recipients = await resolveNotificationRecipients({
    organizationId: body.organizationId,
    audiencePanel: body.audiencePanel,
    audienceRole: body.audienceRole,
    audienceRoles: body.audienceRoles,
  });

  const result = await queueNotificationForUsers({
    recipientUserIds: recipients.map((recipient) => recipient.id),
    audiencePanel: body.audiencePanel,
    audienceRole: body.audienceRoles?.join(",") ?? body.audienceRole,
    deliveryChannel: body.deliveryChannel,
    payload,
    templateKey,
    relatedEntityType:
      body.custom?.relatedEntityType ?? body.template?.overrides?.relatedEntityType,
    relatedEntityId: body.custom?.relatedEntityId ?? body.template?.overrides?.relatedEntityId,
    broadcastId,
    createdByUser: user?.id ?? null,
  });

  return c.json(
    createSuccessResponse({
      broadcastId,
      ...result,
      message: "Notification broadcast queued",
    }),
    202
  );
});

registerOpenApiRoute(internalNotificationGroup, notifyResourceEvent, async (c) => {
  if (!isInternalRequestAuthorized(c.req.header("x-proptryx-internal-secret"))) {
    return c.json(
      createErrorResponse({
        error: "Unauthorized",
        message: "Invalid internal notification secret",
      }),
      401
    );
  }

  const body = c.req.valid("json");
  const triggers = await getActiveNotificationTriggers({
    sourceService: body.sourceService,
    resource: body.resource,
    operation: body.operation,
    phase: body.phase,
  });

  if (triggers.length === 0) {
    return c.json(
      createSuccessResponse({
        broadcastId: null,
        recipientCount: 0,
        dashboardNotificationCount: 0,
        pushSubscriptionCount: 0,
        message: "No active trigger matched this resource event",
      }),
      202
    );
  }

  const variables = normalizeTriggerVariables(body.variables);
  const matchedTriggers = triggers.filter((trigger) =>
    triggerConditionsMatch(trigger, body.data, variables)
  );
  const aggregate = {
    recipientCount: 0,
    dashboardNotificationCount: 0,
    pushSubscriptionCount: 0,
  };
  const failures: string[] = [];

  for (const trigger of matchedTriggers) {
    const recipients = await resolveNotificationRecipients({
      recipientUserIds: body.recipientUserIds,
      organizationId: body.organizationId ?? undefined,
      audiencePanel: trigger.audiencePanel,
      audienceRole: trigger.audienceRole,
      audienceRoles: trigger.audienceRoles,
    });
    const relatedEntityType = body.relatedEntityType ?? trigger.resource;
    const relatedEntityId = body.relatedEntityId ?? variables.id ?? null;

    try {
      const resolvedTriggerPayload = await resolveTriggerEventPayload({
        trigger,
        variables,
        data: body.data,
        relatedEntityType,
        relatedEntityId,
        defaultTitle: body.defaultTitle,
        defaultBody: body.defaultBody,
        defaultActionUrl: body.defaultActionUrl,
        defaultTag: body.defaultTag,
        defaultIcon: body.defaultIcon,
        defaultImage: body.defaultImage,
      });
      const result =
        recipients.length > 0
          ? await queueNotificationForUsers({
              recipientUserIds: recipients.map((recipient) => recipient.id),
              audiencePanel: trigger.audiencePanel,
              audienceRole: trigger.audienceRoles.length
                ? trigger.audienceRoles.join(",")
                : trigger.audienceRole,
              deliveryChannel: trigger.deliveryChannel,
              payload: resolvedTriggerPayload.payload,
              templateKey: resolvedTriggerPayload.templateKey,
              relatedEntityType,
              relatedEntityId,
            })
          : {
              recipientCount: 0,
              dashboardNotificationCount: 0,
              pushSubscriptionCount: 0,
            };

      aggregate.recipientCount += result.recipientCount;
      aggregate.dashboardNotificationCount += result.dashboardNotificationCount;
      aggregate.pushSubscriptionCount += result.pushSubscriptionCount;

      await recordNotificationTriggerExecution({
        trigger,
        status: "success",
        recipientCount: result.recipientCount,
        dashboardNotificationCount: result.dashboardNotificationCount,
        pushSubscriptionCount: result.pushSubscriptionCount,
        relatedEntityType,
        relatedEntityId,
        data: {
          ...body.variables,
          recipientCount: recipients.length,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown trigger execution error";
      failures.push(`${trigger.key}: ${message}`);

      await recordNotificationTriggerExecution({
        trigger,
        status: "failed",
        relatedEntityType,
        relatedEntityId,
        error: message,
        data: body.variables,
      });
    }
  }

  return c.json(
    createSuccessResponse({
      broadcastId: null,
      ...aggregate,
      message:
        failures.length > 0
          ? `Notification trigger event processed with ${failures.length} failure(s)`
          : "Notification trigger event processed",
      matchedTriggerCount: matchedTriggers.length,
      failedTriggerCount: failures.length,
    }),
    202
  );
});

registerOpenApiRoute(internalNotificationGroup, notifyPropertyPublished, async (c) => {
  if (!isInternalRequestAuthorized(c.req.header("x-proptryx-internal-secret"))) {
    return c.json(
      createErrorResponse({
        error: "Unauthorized",
        message: "Invalid internal notification secret",
      }),
      401
    );
  }

  const body = c.req.valid("json");
  const recipientUserIds = [
    body.propertyOwner?.id,
    ...body.organizationOwners.map((owner) => owner.id),
  ].filter((id): id is string => Boolean(id));
  const preferences = await getNotificationPreferencesForUsers(recipientUserIds);
  const emailEnabledOrganizationOwners = body.organizationOwners.filter(
    (owner) => preferences.get(owner.id)?.emailNotificationsEnabled !== false
  );
  const propertyOwner =
    body.propertyOwner &&
    preferences.get(body.propertyOwner.id)?.emailNotificationsEnabled !== false
      ? {
          name: body.propertyOwner.name,
          email: body.propertyOwner.email,
        }
      : null;

  await sendPropertyPublishedNotificationEmails({
    propertyId: body.propertyId,
    propertyName: body.propertyName,
    organizationName: body.organizationName,
    propertyOwner,
    organizationOwners: emailEnabledOrganizationOwners,
    publishedAt: new Date(body.publishedAt),
  });

  const [trigger] = await getActiveNotificationTriggers({
    sourceService: "kernel",
    resource: "property",
    operation: "publish",
    phase: "after",
  });
  const triggerVariables = {
    propertyId: body.propertyId,
    propertyName: body.propertyName,
    organizationName: body.organizationName,
    publishedAt: body.publishedAt,
  };
  const resolvedTriggerPayload = trigger
    ? await resolveTriggerEventPayload({
        trigger,
        variables: triggerVariables,
        data: {
          type: "property-published",
          propertyName: body.propertyName,
        },
        relatedEntityType: "property",
        relatedEntityId: body.propertyId,
        defaultTitle: "Property published",
        defaultBody: `${body.propertyName} is now published.`,
        defaultActionUrl: `/data/directory/property/control/${body.propertyId}`,
        defaultTag: `property:${body.propertyId}:published`,
      })
    : null;

  let result: {
    recipientCount: number;
    dashboardNotificationCount: number;
    pushSubscriptionCount: number;
  };

  try {
    result =
      recipientUserIds.length > 0
        ? await queueNotificationForUsers({
            recipientUserIds,
            audiencePanel: trigger?.audiencePanel ?? "ALL",
            audienceRole: trigger?.audienceRoles.length
              ? trigger.audienceRoles.join(",")
              : trigger?.audienceRole,
            deliveryChannel: trigger?.deliveryChannel ?? "BOTH",
            payload: resolvedTriggerPayload?.payload ?? {
              title: "Property published",
              body: `${body.propertyName} is now published.`,
              actionUrl: `/data/directory/property/control/${body.propertyId}`,
              tag: `property:${body.propertyId}:published`,
              priority: "high",
              data: {
                type: "property-published",
                entityType: "property",
                entityId: body.propertyId,
                propertyName: body.propertyName,
              },
            },
            templateKey: resolvedTriggerPayload?.templateKey ?? "property-published",
            relatedEntityType: "property",
            relatedEntityId: body.propertyId,
          })
        : {
            recipientCount: 0,
            dashboardNotificationCount: 0,
            pushSubscriptionCount: 0,
          };

    if (trigger) {
      await recordNotificationTriggerExecution({
        trigger,
        status: "success",
        recipientCount: result.recipientCount,
        dashboardNotificationCount: result.dashboardNotificationCount,
        pushSubscriptionCount: result.pushSubscriptionCount,
        relatedEntityType: "property",
        relatedEntityId: body.propertyId,
        data: triggerVariables,
      });
    }
  } catch (error) {
    if (trigger) {
      await recordNotificationTriggerExecution({
        trigger,
        status: "failed",
        relatedEntityType: "property",
        relatedEntityId: body.propertyId,
        error: error instanceof Error ? error.message : "Unknown trigger execution error",
        data: triggerVariables,
      });
    }

    throw error;
  }

  return c.json(
    createSuccessResponse({
      broadcastId: null,
      ...result,
      message: "Property published notification queued",
    }),
    202
  );
});
