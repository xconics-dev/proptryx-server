export type PushNotificationPriority = "normal" | "high";

export interface PushNotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string | null;
  image?: string | null;
  badge?: string | null;
  actionUrl?: string | null;
  tag?: string | null;
  priority?: PushNotificationPriority;
  data?: Record<string, string | number | boolean | null | undefined>;
  actions?: PushNotificationAction[];
}

export interface PushTemplateRenderInput {
  templateKey: string;
  variables?: Record<string, string | number | boolean | null | undefined>;
  overrides?: Partial<PushNotificationPayload>;
}

export interface SendPushToTokensOptions {
  tokens: string[];
  payload: PushNotificationPayload;
  dryRun?: boolean;
}

export interface SendPushToTokensResult {
  requested: number;
  successCount: number;
  failureCount: number;
  invalidTokens: string[];
}
