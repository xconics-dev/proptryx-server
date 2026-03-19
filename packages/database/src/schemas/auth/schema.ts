import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { orgMemberRole, userRole } from "./rbac";
import { zone } from "../zone-region";
import { CompanyType, OrganizationType } from "./enums";

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    role: text("role").references(() => userRole.name, {
      onDelete: "set null",
    }),
    zoneId: text("zone_id").references(() => zone.id, { onDelete: "set null" }),
    banned: boolean("banned").default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires"),
    phoneNumber: text("phone_number"),
    phoneNumberVerified: boolean("phone_number_verified").default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("user_role_idx").on(table.role), index("user_zoneId_idx").on(table.zoneId)]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)]
);

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    type: OrganizationType("type").notNull(),
    createdAt: timestamp("created_at").notNull(),
    metadata: text("metadata"),
    email: text("email"),
    gstNumber: text("gst_number"),
    phoneNumber: text("phone_number"),
    industry: text("industry"),
    companyType: CompanyType("company_type"),
    isActive: boolean("is_active").default(false).notNull(),
    razorpayCustomerId: text("razorpay_customer_id"),
  },
  (table) => [
    uniqueIndex("organization_slug_uidx").on(table.slug),
    index("organization_razorpayCustomerId_idx").on(table.razorpayCustomerId),
  ]
);

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    activeOrganizationId: text("active_organization_id").references(() => organization.id, {
      onDelete: "set null",
    }),
    impersonatedBy: text("impersonated_by"),
  },
  (table) => [
    uniqueIndex("session_token_uidx").on(table.token),
    index("session_userId_idx").on(table.userId),
    index("session_activeOrganizationId_idx").on(table.activeOrganizationId),
    index("session_expiresAt_idx").on(table.expiresAt),
  ]
);

export const member = pgTable(
  "member",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: text("role")
      .notNull()
      .references(() => orgMemberRole.name),
    createdAt: timestamp("created_at").notNull(),
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
    index("member_organizationId_role_idx").on(table.organizationId, table.role),
  ]
);

export const invitation = pgTable(
  "invitation",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role")
      .notNull()
      .references(() => orgMemberRole.name),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    inviterId: text("inviter_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (table) => [
    index("invitation_organizationId_idx").on(table.organizationId),
    index("invitation_email_idx").on(table.email),
  ]
);

export const subscriptionPlans = pgTable(
  "subscription_plans",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(),
    name: text("name").notNull(),
    description: text("description"),
    amountInPaise: integer("amount_in_paise").notNull(),
    currency: text("currency").default("INR").notNull(),
    billingInterval: text("billing_interval").default("monthly").notNull(),
    razorpayPlanId: text("razorpay_plan_id").notNull(),
    totalCount: integer("total_count"),
    quantity: integer("quantity").default(1).notNull(),
    trialDays: integer("trial_days").default(0).notNull(),
    includedProperties: integer("included_properties").default(0).notNull(),
    addonPropertyOneTimeCostInPaise: integer("addon_property_one_time_cost_in_paise")
      .default(0)
      .notNull(),
    features: jsonb("features")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("subscription_plans_code_uidx").on(table.code),
    uniqueIndex("subscription_plans_razorpayPlanId_uidx").on(table.razorpayPlanId),
    index("subscription_plans_isActive_idx").on(table.isActive),
  ]
);

export const organizationSubscription = pgTable(
  "organization_subscription",
  {
    id: text("id").primaryKey(),
    organizationId: text("organization_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    subscriptionPlanId: text("subscription_plan_id").references(() => subscriptionPlans.id, {
      onDelete: "set null",
    }),
    planCode: text("plan_code").notNull(),
    razorpayCustomerId: text("razorpay_customer_id").notNull(),
    razorpaySubscriptionId: text("razorpay_subscription_id"),
    razorpayPlanId: text("razorpay_plan_id").notNull(),
    status: text("status").default("created").notNull(),
    quantity: integer("quantity").default(1).notNull(),
    totalCount: integer("total_count"),
    paidCount: integer("paid_count").default(0).notNull(),
    remainingCount: integer("remaining_count"),
    baseAmountInPaise: integer("base_amount_in_paise").default(0).notNull(),
    billingPeriod: text("billing_period").default("monthly").notNull(),
    trialDaysApplied: integer("trial_days_applied").default(0).notNull(),
    includedProperties: integer("included_properties").default(0).notNull(),
    additionalProperties: integer("additional_properties").default(0).notNull(),
    addonPropertyOneTimeCostInPaise: integer("addon_property_one_time_cost_in_paise")
      .default(0)
      .notNull(),
    addonOneTimeTotalInPaise: integer("addon_one_time_total_in_paise").default(0).notNull(),
    currentStart: timestamp("current_start"),
    currentEnd: timestamp("current_end"),
    trialStart: timestamp("trial_start"),
    trialEnd: timestamp("trial_end"),
    endedAt: timestamp("ended_at"),
    cancelledAt: timestamp("cancelled_at"),
    pausedAt: timestamp("paused_at"),
    shortUrl: text("short_url"),
    cancelAtCycleEnd: boolean("cancel_at_cycle_end").default(false).notNull(),
    notes: jsonb("notes").$type<Record<string, string>>().default(sql`'{}'::jsonb`).notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("organization_subscription_organizationId_uidx").on(table.organizationId),
    uniqueIndex("organization_subscription_razorpaySubscriptionId_uidx").on(
      table.razorpaySubscriptionId
    ),
    index("organization_subscription_status_idx").on(table.status),
    index("organization_subscription_planCode_idx").on(table.planCode),
    index("organization_subscription_subscriptionPlanId_idx").on(table.subscriptionPlanId),
  ]
);

export const userRelations = relations(user, ({ many, one }) => ({
  accounts: many(account),
  sessions: many(session),
  members: many(member),
  invitations: many(invitation),
  roleDefinition: one(userRole, {
    fields: [user.role],
    references: [userRole.name],
  }),
  zone: one(zone, {
    fields: [user.zoneId],
    references: [zone.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
  activeOrganization: one(organization, {
    fields: [session.activeOrganizationId],
    references: [organization.id],
  }),
}));

export const organizationRelations = relations(organization, ({ many, one }) => ({
  activeSessions: many(session),
  members: many(member),
  invitations: many(invitation),
  subscription: one(organizationSubscription, {
    fields: [organization.id],
    references: [organizationSubscription.organizationId],
  }),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),
  orgMemberRole: one(orgMemberRole, {
    fields: [member.role],
    references: [orgMemberRole.name],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
  orgMemberRole: one(orgMemberRole, {
    fields: [invitation.role],
    references: [orgMemberRole.name],
  }),
}));

export const subscriptionPlansRelations = relations(subscriptionPlans, ({ many }) => ({
  organizationSubscriptions: many(organizationSubscription),
}));

export const organizationSubscriptionRelations = relations(organizationSubscription, ({ one }) => ({
  organization: one(organization, {
    fields: [organizationSubscription.organizationId],
    references: [organization.id],
  }),
  plan: one(subscriptionPlans, {
    fields: [organizationSubscription.subscriptionPlanId],
    references: [subscriptionPlans.id],
  }),
}));
