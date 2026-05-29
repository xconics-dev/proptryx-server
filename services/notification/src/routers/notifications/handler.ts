import type { AppBindings } from "@/types/app";
import { upgradeWebSocket } from "@hono/node-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import { env } from "@/config/env";
import { db, notificationTemplate } from "@proptryx/database";
import { sendPropertyPublishedNotificationEmails } from "@proptryx/notification";
import {
  createErrorResponse,
  createSuccessResponse,
  generateRandomId,
  getBetterAuthContext,
  registerOpenApiRoute,
} from "@proptryx/utils";
import { eq } from "drizzle-orm";
import {
  archiveMyNotification,
  broadcastProptryxNotification,
  createNotificationTemplate,
  deleteNotificationTemplate as deleteNotificationTemplateRoute,
  deleteMyNotification,
  getMyUnreadNotificationCount,
  getNotificationTemplate,
  getNotificationPreferences,
  listMyNotifications,
  listNotificationTemplates,
  markAllMyNotificationsRead,
  markMyNotificationRead,
  notifyPropertyPublished,
  registerPushSubscription,
  sendProptryxNotification,
  streamMyNotifications,
  testMyPushNotification,
  updateNotificationTemplate,
  updateNotificationPreferences,
  unregisterPushSubscriptionRoute,
  authMiddleware,
  notificationRateLimit,
} from "./openapi.route";
import { fetchNotificationList, fetchNotificationTemplateList } from "./list";
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
  const result = await sendPushFireAndForget({
    userIds: [userId],
    payload: {
      icon: "/logo/logo.png",
      badge: "/logo/logo.png",
      priority: "high",
      ...body,
      data: {
        type: "manual-fcm-test",
        ...(body.data ?? {}),
      },
    },
  });

  return c.json(
    createSuccessResponse({
      message: result.skipped
        ? "Firebase Cloud Messaging is not configured on the server"
        : result.successCount > 0
          ? "Test push sent through Firebase Cloud Messaging"
          : "No active browser push token accepted the test push",
      pushSubscriptionCount: result.requested,
      requested: result.requested,
      successCount: result.successCount,
      failureCount: result.failureCount,
      invalidTokens: result.invalidTokens,
      skipped: result.skipped,
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
      icon: body.icon ?? null,
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

  const result =
    recipientUserIds.length > 0
      ? await queueNotificationForUsers({
          recipientUserIds,
          audiencePanel: "ALL",
          deliveryChannel: "BOTH",
          payload: {
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
          templateKey: "property-published",
          relatedEntityType: "property",
          relatedEntityId: body.propertyId,
        })
      : {
          recipientCount: 0,
          dashboardNotificationCount: 0,
          pushSubscriptionCount: 0,
        };

  return c.json(
    createSuccessResponse({
      broadcastId: null,
      ...result,
      message: "Property published notification queued",
    }),
    202
  );
});
