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
import { organization } from "../schema";

export type SubscriptionPlanMetadata = Record<string, unknown>;
export type SubscriptionPlanFeatures = Record<string, unknown>;

export const subscriptionPlan = pgTable(
  "subscription_plan",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    rzPlanId: text("rz_plan_id").notNull(),
    rzAnnualPlanId: text("rz_annual_plan_id"),
    description: text("description"),
    group: text("group"),
    totalCount: integer("total_count"),
    quantity: integer("quantity"),
    freeTrialDays: integer("free_trial_days"),
    features: jsonb("features").$type<SubscriptionPlanFeatures>().default(sql`'{}'::jsonb`),
    metadata: jsonb("metadata").$type<SubscriptionPlanMetadata>().default(sql`'{}'::jsonb`),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("subscription_plan_rzPlanId_uidx").on(table.rzPlanId),
    index("subscription_plan_isActive_idx").on(table.isActive),
  ]
);

export const subscription = pgTable(
  "subscription",
  {
    id: text("id").primaryKey(),
    plan: text("plan").notNull(),
    planId: text("plan_id").references(() => subscriptionPlan.id),
    referenceId: text("reference_id")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    razorpayCustomerId: text("razorpay_customer_id"),
    razorpaySubscriptionId: text("razorpay_subscription_id"),
    razorpayPlanId: text("razorpay_plan_id"),
    status: text("status").default("created").notNull(),
    currentStart: timestamp("current_start"),
    currentEnd: timestamp("current_end"),
    endedAt: timestamp("ended_at"),
    quantity: integer("quantity").default(1),
    totalCount: integer("total_count"),
    paidCount: integer("paid_count").default(0),
    remainingCount: integer("remaining_count"),
    cancelledAt: timestamp("cancelled_at"),
    pausedAt: timestamp("paused_at"),
    shortUrl: text("short_url"),
    cancelAtCycleEnd: boolean("cancel_at_cycle_end").default(false),
    groupId: text("group_id"),
    billingPeriod: text("billing_period"),
    trialStart: timestamp("trial_start"),
    trialEnd: timestamp("trial_end"),
    metadata: text("metadata"),
    renewedAt: timestamp("renewed_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [
    index("subscription_referenceId_idx").on(table.referenceId),
    index("subscription_referenceId_groupId_idx").on(table.referenceId, table.groupId),
    index("subscription_razorpayCustomerId_idx").on(table.razorpayCustomerId),
    uniqueIndex("subscription_razorpaySubscriptionId_uidx").on(table.razorpaySubscriptionId),
    index("subscription_status_idx").on(table.status),
  ]
);

export const subscriptionRelations = relations(subscription, ({ one }) => ({
  organization: one(organization, {
    fields: [subscription.referenceId],
    references: [organization.id],
  }),
}));

export const subscriptionPlanRelations = relations(subscriptionPlan, ({ many }) => ({
  subscriptions: many(subscription),
}));
