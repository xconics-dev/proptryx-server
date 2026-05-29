import type { PushNotificationPayload, PushTemplateRenderInput } from "./types";

type PushNotificationTemplate = Omit<PushNotificationPayload, "priority" | "data"> & {
  data?: Record<string, string>;
};

const DEFAULT_ICON = "/logo/logo.png";
const DEFAULT_BADGE = "/logo/logo.png";

export const pushNotificationTemplates: Record<string, PushNotificationTemplate> = {
  "property-published": {
    title: "Property published",
    body: "{{propertyName}} is now published.",
    icon: DEFAULT_ICON,
    badge: DEFAULT_BADGE,
    tag: "property:{{propertyId}}:published",
    actionUrl: "/data/directory/property/control/{{propertyId}}",
    data: {
      type: "property-published",
      entityType: "property",
      entityId: "{{propertyId}}",
    },
  },
} as const satisfies Record<
  string,
  Omit<PushNotificationPayload, "priority"> & { data?: Record<string, string> }
>;

export type PushNotificationTemplateKey = keyof typeof pushNotificationTemplates;

const renderValue = (value: string, variables: NonNullable<PushTemplateRenderInput["variables"]>) =>
  value.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const replacement = variables[key];
    return replacement == null ? "" : String(replacement);
  });

const renderRecord = (
  value: Record<string, string> | undefined,
  variables: NonNullable<PushTemplateRenderInput["variables"]>
) => {
  if (!value) {
    return undefined;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, renderValue(item, variables)])
  );
};

export function renderPushNotificationTemplate({
  templateKey,
  variables = {},
  overrides = {},
}: PushTemplateRenderInput): PushNotificationPayload {
  const template = pushNotificationTemplates[templateKey as PushNotificationTemplateKey];

  if (!template) {
    throw new Error(`Unknown push notification template: ${templateKey}`);
  }

  return {
    title: renderValue(template.title, variables),
    body: renderValue(template.body, variables),
    icon: template.icon ? renderValue(template.icon, variables) : undefined,
    image: template.image ? renderValue(template.image, variables) : undefined,
    badge: template.badge ? renderValue(template.badge, variables) : undefined,
    actionUrl: template.actionUrl ? renderValue(template.actionUrl, variables) : undefined,
    tag: template.tag ? renderValue(template.tag, variables) : undefined,
    data: {
      ...renderRecord(template.data, variables),
      ...overrides.data,
    },
    ...overrides,
  };
}
