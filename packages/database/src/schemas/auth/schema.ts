import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { zone } from "../zone-region";
import { AccessPanel, BusinessType, OrganizationType } from "./enums";
import { DEFAULT_PLAN_FEATURES, type SubscriptionPlanFeatures } from "./types";

export const user = pgTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    image: text("image"),
    role: text("role"),
    panel: AccessPanel("panel"),
    zoneId: text("zone_id").references((): AnyPgColumn => zone.id, {
      onDelete: "set null",
    }),
    banned: boolean("banned").default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires"),
    phoneNumber: text("phone_number"),
    phoneNumberVerified: boolean("phone_number_verified").default(false),

    // For Kepp Reference
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),

    createdByUser: text("created_by_user").references((): AnyPgColumn => user.id, {
      onDelete: "set null",
    }),
    updatedByUser: text("updated_by_user").references((): AnyPgColumn => user.id, {
      onDelete: "set null",
    }),
    deletedByUser: text("deleted_by_user").references((): AnyPgColumn => user.id, {
      onDelete: "set null",
    }),
    isDeleted: boolean("is_deleted").default(false).notNull(),
  },
  (table) => [
    index("user_name_idx").on(table.name),
    index("user_role_idx").on(table.role),
    index("user_panel_idx").on(table.panel),
    index("user_zoneId_idx").on(table.zoneId),
  ]
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

export const organization = pgTable(
  "organization",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    type: OrganizationType("type").notNull(),
    businessType: BusinessType("business_type").default("GENERAL"),
    metadata: text("metadata"),
    email: text("email"),
    gstNumber: text("gst_number"),
    phoneNumber: text("phone_number"),
    industry: text("industry"), // IT, Manufacturing, etc.
    companyType: text("company_type"), // Pvt Ltd, LLP, etc.
    isActive: boolean("is_active").default(false).notNull(),
    razorpayCustomerId: text("razorpay_customer_id"),

    // For Kepp Reference
    createdByUser: text("created_by_user").references(() => user.id, {
      onDelete: "set null",
    }),
    updatedByUser: text("updated_by_user").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),

    // For soft deletion
    isDeleted: boolean("is_deleted").default(false).notNull(),
    deletedAt: timestamp("deleted_at"),
    deletedByUser: text("deleted_by_user").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    uniqueIndex("organization_slug_uidx").on(table.slug),
    index("organization_isDeleted_createdAt_idx").on(table.isDeleted, table.createdAt),
    index("organization_isDeleted_updatedAt_idx").on(table.isDeleted, table.updatedAt),
    index("organization_isDeleted_name_idx").on(table.isDeleted, table.name),
    index("organization_isDeleted_type_idx").on(table.isDeleted, table.type),
    index("organization_isDeleted_isActive_idx").on(table.isDeleted, table.isActive),
    index("organization_email_idx").on(table.email),
    index("organization_phoneNumber_idx").on(table.phoneNumber),
    index("organization_gstNumber_idx").on(table.gstNumber),
    index("organization_razorpayCustomerId_idx").on(table.razorpayCustomerId),
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
    role: text("role").notNull(),
    panel: AccessPanel("panel").default("company").notNull(),

    // For Kepp Reference
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
    deletedAt: timestamp("deleted_at"),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    deletedByUser: text("deleted_by_user").references(() => user.id, {
      onDelete: "set null",
    }),
  },
  (table) => [
    index("member_organizationId_idx").on(table.organizationId),
    index("member_userId_idx").on(table.userId),
    index("member_panel_idx").on(table.panel),
    index("member_organizationId_role_idx").on(table.organizationId, table.role),
    index("member_organizationId_isDeleted_userId_idx").on(
      table.organizationId,
      table.isDeleted,
      table.userId
    ),
    index("member_organizationId_isDeleted_role_idx").on(
      table.organizationId,
      table.isDeleted,
      table.role
    ),
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
    role: text("role").notNull(),
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
    code: text("code").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    amountInPaise: integer("amount_in_paise").notNull(),
    discountedAmountInPaise: integer("discounted_amount_in_paise"),
    discountAvailableTill: timestamp("discount_available_till"),
    currency: text("currency").default("INR").notNull(),
    billingInterval: text("billing_interval").default("monthly").notNull(),
    razorpayPlanId: text("razorpay_plan_id").notNull(),
    totalCount: integer("total_count"),
    quantity: integer("quantity").default(1).notNull(),
    trialDays: integer("trial_days").default(0).notNull(),
    addonPropertyOneTimeCostInPaise: integer("addon_property_one_time_cost_in_paise")
      .default(0)
      .notNull(),
    features: jsonb("features")
      .$type<SubscriptionPlanFeatures>()
      .default(DEFAULT_PLAN_FEATURES)
      .notNull(),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdByUser: text("created_by_user").references((): AnyPgColumn => user.id, {
      onDelete: "set null",
    }),
    updatedByUser: text("updated_by_user").references((): AnyPgColumn => user.id, {
      onDelete: "set null",
    }),
    deletedByUser: text("deleted_by_user").references((): AnyPgColumn => user.id, {
      onDelete: "set null",
    }),
    isDeleted: boolean("is_deleted").default(false).notNull(),
    deletedAt: timestamp("deleted_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("subscription_plans_code_uidx")
      .on(table.code)
      .where(sql`${table.isDeleted} = false`),
    uniqueIndex("subscription_plans_razorpayPlanId_uidx")
      .on(table.razorpayPlanId)
      .where(sql`${table.isDeleted} = false`),
    index("subscription_plans_isDeleted_isActive_idx").on(table.isDeleted, table.isActive),
    index("subscription_plans_discountAvailableTill_idx").on(table.discountAvailableTill),
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
    createdByUser: text("created_by_user").references((): AnyPgColumn => user.id, {
      onDelete: "set null",
    }),
    updatedByUser: text("updated_by_user").references((): AnyPgColumn => user.id, {
      onDelete: "set null",
    }),
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
    index("organization_subscription_subscriptionPlanId_status_idx").on(
      table.subscriptionPlanId,
      table.status
    ),
    index("organization_subscription_billingPeriod_idx").on(table.billingPeriod),
    index("organization_subscription_createdAt_idx").on(table.createdAt),
    index("organization_subscription_createdByUser_idx").on(table.createdByUser),
  ]
);
