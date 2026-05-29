export const DATABASE_RESOURCES = {
  account: "account",
  broker_request: "broker_request",
  company_request: "company_request",
  faq: "faq",
  invitation: "invitation",
  member: "member",
  meeting: "meeting",
  notification: "notification",
  notification_preference: "notification_preference",
  notification_push_subscription: "notification_push_subscription",
  notification_template: "notification_template",
  property: "property",
  organization: "organization",
  organization_subscription: "organization_subscription",
  rbac_role: "rbac_role",
  rbac_role_permission: "rbac_role_permission",
  region: "region",
  session: "session",
  subscription_plans: "subscription_plans",
  testimonial: "testimonial",
  user: "user",
  zone: "zone",
} as const;

export type DatabaseResource = (typeof DATABASE_RESOURCES)[keyof typeof DATABASE_RESOURCES];

const DATABASE_RESOURCE_LIST = Object.freeze(
  Object.values(DATABASE_RESOURCES)
) as readonly DatabaseResource[];

export function getDatabaseResources(): readonly DatabaseResource[] {
  return DATABASE_RESOURCE_LIST;
}
