import { pgEnum } from "drizzle-orm/pg-core";

export const NotificationDeliveryChannel = pgEnum("notification_delivery_channel", [
  "DASHBOARD",
  "PUSH",
  "BOTH",
]);

export const NotificationAudiencePanel = pgEnum("notification_audience_panel", [
  "PROPTRYX",
  "COMPANY",
  "ALL",
]);

export const NotificationStatus = pgEnum("notification_status", [
  "QUEUED",
  "SENT",
  "PARTIAL",
  "FAILED",
  "SKIPPED",
]);
