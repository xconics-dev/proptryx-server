import { relations, sql } from "drizzle-orm";
import { boolean, index, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { user } from "../auth/schema";
import { createAuditRelationNames } from "../utils/audit";
import {
  NotificationAudiencePanel,
  NotificationDeliveryChannel,
  NotificationStatus,
} from "./enums";

const notificationAuditRelations = createAuditRelationNames("notification");
const notificationTemplateAuditRelations = createAuditRelationNames("notification_template");

export const notificationTemplate = pgTable(
  "notification_template",
  {
    id: text("id").primaryKey(),
    key: text("key").notNull(),
    name: text("name").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    icon: text("icon"),
    image: text("image"),
    actionUrl: text("action_url"),
    data: jsonb("data").$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    createdByUser: text("created_by_user").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedByUser: text("updated_by_user").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("notification_template_key_uidx").on(table.key),
    index("notification_template_isActive_idx").on(table.isActive),
  ]
);

export const notification = pgTable(
  "notification",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").references(() => user.id, {
      onDelete: "cascade",
    }),
    audiencePanel: NotificationAudiencePanel("audience_panel").default("ALL").notNull(),
    audienceRole: text("audience_role"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    templateKey: text("template_key"),
    deliveryChannel: NotificationDeliveryChannel("delivery_channel").default("BOTH").notNull(),
    pushStatus: NotificationStatus("push_status").default("QUEUED").notNull(),
    dashboardStatus: NotificationStatus("dashboard_status").default("QUEUED").notNull(),
    icon: text("icon"),
    image: text("image"),
    actionUrl: text("action_url"),
    tag: text("tag"),
    relatedEntityType: text("related_entity_type"),
    relatedEntityId: text("related_entity_id"),
    broadcastId: text("broadcast_id"),
    data: jsonb("data").$type<Record<string, unknown>>().default(sql`'{}'::jsonb`).notNull(),
    readAt: timestamp("read_at"),
    clickedAt: timestamp("clicked_at"),
    archivedAt: timestamp("archived_at"),
    deletedAt: timestamp("deleted_at"),
    sentAt: timestamp("sent_at"),
    pushError: text("push_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    createdByUser: text("created_by_user").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("notification_user_id_created_at_idx").on(table.userId, table.createdAt),
    index("notification_user_id_read_at_idx").on(table.userId, table.readAt),
    index("notification_user_id_archived_at_idx").on(table.userId, table.archivedAt),
    index("notification_user_id_deleted_at_idx").on(table.userId, table.deletedAt),
    index("notification_broadcast_id_idx").on(table.broadcastId),
    index("notification_template_key_idx").on(table.templateKey),
    index("notification_related_entity_idx").on(table.relatedEntityType, table.relatedEntityId),
  ]
);

export const notificationPushSubscription = pgTable(
  "notification_push_subscription",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, {
        onDelete: "cascade",
      }),
    token: text("token").notNull(),
    deviceId: text("device_id"),
    platform: text("platform"),
    browser: text("browser"),
    userAgent: text("user_agent"),
    isActive: boolean("is_active").default(true).notNull(),
    lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("notification_push_subscription_token_uidx").on(table.token),
    index("notification_push_subscription_user_id_idx").on(table.userId),
    index("notification_push_subscription_user_active_idx").on(table.userId, table.isActive),
  ]
);

export const notificationPreference = pgTable(
  "notification_preference",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, {
        onDelete: "cascade",
      }),
    emailNotificationsEnabled: boolean("email_notifications_enabled").default(true).notNull(),
    dashboardNotificationsEnabled: boolean("dashboard_notifications_enabled")
      .default(true)
      .notNull(),
    pushNotificationsEnabled: boolean("push_notifications_enabled").default(true).notNull(),
    browserPermissionPromptedAt: timestamp("browser_permission_prompted_at"),
    browserPermissionStatus: text("browser_permission_status"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("notification_preference_user_id_uidx").on(table.userId),
    index("notification_preference_user_id_idx").on(table.userId),
  ]
);

export const notificationRelations = relations(notification, ({ one }) => ({
  user: one(user, {
    fields: [notification.userId],
    references: [user.id],
  }),
  createdByUser: one(user, {
    fields: [notification.createdByUser],
    references: [user.id],
    relationName: notificationAuditRelations.created,
  }),
}));

export const notificationTemplateRelations = relations(notificationTemplate, ({ one }) => ({
  createdByUser: one(user, {
    fields: [notificationTemplate.createdByUser],
    references: [user.id],
    relationName: notificationTemplateAuditRelations.created,
  }),
  updatedByUser: one(user, {
    fields: [notificationTemplate.updatedByUser],
    references: [user.id],
    relationName: notificationTemplateAuditRelations.updated,
  }),
}));

export const notificationPushSubscriptionRelations = relations(
  notificationPushSubscription,
  ({ one }) => ({
    user: one(user, {
      fields: [notificationPushSubscription.userId],
      references: [user.id],
    }),
  })
);

export const notificationPreferenceRelations = relations(notificationPreference, ({ one }) => ({
  user: one(user, {
    fields: [notificationPreference.userId],
    references: [user.id],
  }),
}));
