import { env } from "@/config/env";
import { logger } from "@/lib/logger";

type ResourceEventPhase = "before" | "after";

type EmitResourceEventInput = {
  sourceService?: string;
  resource: string;
  operation: string;
  phase?: ResourceEventPhase;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
  recipientUserIds?: string[];
  organizationId?: string | null;
  variables?: Record<string, unknown>;
  data?: Record<string, unknown>;
  defaultTitle?: string | null;
  defaultBody?: string | null;
  defaultActionUrl?: string | null;
  defaultTag?: string | null;
  defaultIcon?: string | null;
  defaultImage?: string | null;
  logContext?: string;
};

export async function emitNotificationResourceEvent({
  sourceService = "kernel",
  phase = "after",
  logContext = "kernel.resource-event",
  ...input
}: EmitResourceEventInput) {
  const response = await fetch(`${env.NOTIFICATION_SERVICE_URL}/internal/resource-event`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-proptryx-internal-secret": env.BETTER_AUTH_SECRET,
    },
    body: JSON.stringify({
      sourceService,
      phase,
      resource: input.resource,
      operation: input.operation,
      relatedEntityType: input.relatedEntityType ?? input.resource,
      relatedEntityId: input.relatedEntityId ?? null,
      recipientUserIds: input.recipientUserIds,
      organizationId: input.organizationId ?? undefined,
      variables: input.variables ?? {},
      data: input.data ?? {},
      defaultTitle: input.defaultTitle,
      defaultBody: input.defaultBody,
      defaultActionUrl: input.defaultActionUrl,
      defaultTag: input.defaultTag,
      defaultIcon: input.defaultIcon,
      defaultImage: input.defaultImage,
    }),
  }).catch((error) => {
    logger.error(`[${logContext}] Notification service request failed`, { error });
    return null;
  });

  if (!response?.ok) {
    logger.error(`[${logContext}] Notification trigger event failed`, {
      status: response?.status ?? null,
      body: response ? await response.text().catch(() => null) : null,
    });
  }
}
