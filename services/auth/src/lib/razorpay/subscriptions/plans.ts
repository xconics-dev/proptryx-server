/** biome-ignore-all lint/suspicious/noExplicitAny: Better Auth runtime context is runtime-shaped */
import * as schema from "@proptryx/database";
import type { SubscriptionPlanFeatures } from "@proptryx/database";
import { generateRandomId } from "@proptryx/utils";
import { APIError, type BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { and, asc, eq, sql } from "drizzle-orm";
import {
  createPlanBodySchema,
  deletePlanBodySchema,
  getPlanByCode,
  getPlanById,
  getPlanQuerySchema,
  listPlansQuerySchema,
  normalizePlanCode,
  signedInSessionMiddleware,
  updatePlanBodySchema,
} from "./shared";
import { resolveAuthDatabase } from "../../auth/utils";

const listPlansEndpoint = createAuthEndpoint(
  "/subscription/plans",
  {
    method: "GET",
    query: listPlansQuerySchema,
    metadata: {
      openapi: {
        summary: "List subscription plans",
        description:
          "Returns subscription plans ordered by price. Pass includeInactive=true to include inactive plans.",
        responses: {
          200: { description: "Plans list" },
        },
      },
    },
  },
  async (ctx) => {
    const db = resolveAuthDatabase();
    const includeInactive = ctx.query.includeInactive ?? false;
    const whereClause = includeInactive
      ? eq(schema.subscriptionPlans.isDeleted, false)
      : and(
          eq(schema.subscriptionPlans.isDeleted, false),
          eq(schema.subscriptionPlans.isActive, true)
        );

    const countRows = await db
      .select({
        subscriptionPlanId: schema.organizationSubscription.subscriptionPlanId,
        count: sql<number>`count(*)::int`,
      })
      .from(schema.organizationSubscription)
      .groupBy(schema.organizationSubscription.subscriptionPlanId);

    const countMap = new Map(countRows.map((row) => [row.subscriptionPlanId, Number(row.count)]));

    const plans = await db
      .select()
      .from(schema.subscriptionPlans)
      .where(whereClause)
      .orderBy(asc(schema.subscriptionPlans.amountInPaise));

    const plansWithCounts = plans.map((plan) => ({
      ...plan,
      subscriptionCount: countMap.get(plan.id) ?? 0,
    }));

    return ctx.json({ plans: plansWithCounts });
  }
);

const getPlanEndpoint = createAuthEndpoint(
  "/subscription/plan",
  {
    method: "GET",
    query: getPlanQuerySchema,
    metadata: {
      openapi: {
        summary: "Get a subscription plan by id or code",
        description: "Returns a single subscription plan. Public endpoint.",
        responses: {
          200: { description: "Plan found" },
          400: { description: "id or code required" },
          404: { description: "Plan not found" },
        },
      },
    },
  },
  async (ctx) => {
    const { id, code } = ctx.query;

    if (!id && !code) {
      throw new APIError("BAD_REQUEST", {
        message: "Either id or code query parameter is required.",
      });
    }

    const plan = id ? await getPlanById(id) : await getPlanByCode(code!);

    if (!plan) {
      throw new APIError("NOT_FOUND", { message: "Subscription plan not found." });
    }

    return ctx.json({ plan });
  }
);

const createPlanEndpoint = createAuthEndpoint(
  "/subscription/plan",
  {
    method: "POST",
    body: createPlanBodySchema,
    use: [signedInSessionMiddleware],
    metadata: {
      openapi: {
        summary: "Create a subscription plan",
        description: "Creates a new subscription plan and maps it to a Razorpay plan id.",
        responses: {
          200: { description: "Plan created" },
          409: { description: "Plan with this code already exists" },
        },
      },
    },
  },
  async (ctx) => {
    const db = resolveAuthDatabase();
    const code = normalizePlanCode(ctx.body.code);

    const [existing] = await db
      .select({ id: schema.subscriptionPlans.id })
      .from(schema.subscriptionPlans)
      .where(
        and(eq(schema.subscriptionPlans.code, code), eq(schema.subscriptionPlans.isDeleted, false))
      )
      .limit(1);

    if (existing) {
      throw new APIError("BAD_REQUEST", {
        message: `A subscription plan with code "${code}" already exists. Use PATCH to update it.`,
      });
    }

    const now = new Date();
    const session = ctx.context.session as any;

    const [plan] = await db
      .insert(schema.subscriptionPlans)
      .values({
        id: generateRandomId(),
        code,
        name: ctx.body.name,
        description: ctx.body.description || null,
        amountInPaise: ctx.body.amountInPaise,
        discountedAmountInPaise: ctx.body.discountedAmountInPaise ?? null,
        discountAvailableTill: ctx.body.discountAvailableTill ?? null,
        currency: ctx.body.currency,
        billingInterval: ctx.body.billingInterval,
        razorpayPlanId: ctx.body.razorpayPlanId,
        totalCount: ctx.body.totalCount ?? null,
        quantity: ctx.body.quantity ?? 1,
        trialDays: ctx.body.trialDays ?? 0,
        addonPropertyOneTimeCostInPaise: ctx.body.addonPropertyOneTimeCostInPaise ?? 0,
        isActive: ctx.body.isActive ?? true,
        features: ctx.body.features as SubscriptionPlanFeatures,
        metadata: ctx.body.metadata ?? {},
        createdByUser: session.user.id,
        updatedByUser: session.user.id,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    return ctx.json({ plan });
  }
);

const updatePlanEndpoint = createAuthEndpoint(
  "/subscription/plan",
  {
    method: "PATCH",
    body: updatePlanBodySchema,
    use: [signedInSessionMiddleware],
    metadata: {
      openapi: {
        summary: "Update a subscription plan",
        description: "Updates fields on an existing subscription plan by id.",
        responses: {
          200: { description: "Plan updated" },
          404: { description: "Plan not found" },
        },
      },
    },
  },
  async (ctx) => {
    const db = resolveAuthDatabase();
    const existing = await getPlanById(ctx.body.id);

    if (!existing) {
      throw new APIError("NOT_FOUND", { message: "Subscription plan not found." });
    }

    const updatePayload: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    const session = ctx.context.session as any;

    if (ctx.body.name !== undefined) updatePayload.name = ctx.body.name;
    if (ctx.body.description !== undefined) updatePayload.description = ctx.body.description;
    if (ctx.body.amountInPaise !== undefined) updatePayload.amountInPaise = ctx.body.amountInPaise;
    if (ctx.body.discountedAmountInPaise !== undefined) {
      updatePayload.discountedAmountInPaise = ctx.body.discountedAmountInPaise;
    }
    if (ctx.body.discountAvailableTill !== undefined) {
      updatePayload.discountAvailableTill = ctx.body.discountAvailableTill;
    }
    if (ctx.body.currency !== undefined) updatePayload.currency = ctx.body.currency;
    if (ctx.body.billingInterval !== undefined) {
      updatePayload.billingInterval = ctx.body.billingInterval;
    }
    if (ctx.body.razorpayPlanId !== undefined) {
      updatePayload.razorpayPlanId = ctx.body.razorpayPlanId;
    }
    if (ctx.body.totalCount !== undefined) updatePayload.totalCount = ctx.body.totalCount;
    if (ctx.body.quantity !== undefined) updatePayload.quantity = ctx.body.quantity;
    if (ctx.body.trialDays !== undefined) updatePayload.trialDays = ctx.body.trialDays;
    if (ctx.body.addonPropertyOneTimeCostInPaise !== undefined) {
      updatePayload.addonPropertyOneTimeCostInPaise = ctx.body.addonPropertyOneTimeCostInPaise;
    }
    if (ctx.body.isActive !== undefined) updatePayload.isActive = ctx.body.isActive;
    if (ctx.body.features !== undefined) {
      updatePayload.features = ctx.body.features as SubscriptionPlanFeatures;
    }
    if (ctx.body.metadata !== undefined) updatePayload.metadata = ctx.body.metadata;
    updatePayload.updatedByUser = session.user.id;

    const [updated] = await db
      .update(schema.subscriptionPlans)
      .set(updatePayload as any)
      .where(eq(schema.subscriptionPlans.id, existing.id))
      .returning();

    return ctx.json({ plan: updated });
  }
);

const deletePlanEndpoint = createAuthEndpoint(
  "/subscription/plan",
  {
    method: "DELETE",
    body: deletePlanBodySchema,
    use: [signedInSessionMiddleware],
    metadata: {
      openapi: {
        summary: "Soft delete a subscription plan",
        description: "Soft-deletes a plan and keeps subscription history intact.",
        responses: {
          200: { description: "Plan deleted" },
          404: { description: "Plan not found" },
        },
      },
    },
  },
  async (ctx) => {
    const db = resolveAuthDatabase();
    const existing = await getPlanById(ctx.body.id);

    if (!existing) {
      throw new APIError("NOT_FOUND", { message: "Subscription plan not found." });
    }

    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.organizationSubscription)
      .where(eq(schema.organizationSubscription.subscriptionPlanId, existing.id));

    const subscriptionCount = Number(countRow?.count ?? 0);

    if (subscriptionCount > 0) {
      throw new APIError("BAD_REQUEST", {
        message: `This plan has ${subscriptionCount} connected subscription(s) and cannot be deleted.`,
      });
    }

    const session = ctx.context.session as any;
    const now = new Date();

    await db
      .update(schema.subscriptionPlans)
      .set({
        isActive: false,
        isDeleted: true,
        deletedAt: now,
        deletedByUser: session.user.id,
        updatedByUser: session.user.id,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.subscriptionPlans.id, existing.id),
          eq(schema.subscriptionPlans.isDeleted, false)
        )
      );

    return ctx.json({ success: true, id: existing.id });
  }
);

const listActivePlansPublicEndpoint = createAuthEndpoint(
  "/subscription/active-plans",
  {
    method: "GET",
    metadata: {
      openapi: {
        summary: "List active subscription plans (public)",
        description: "Returns only active plans ordered by price. No auth required. No params.",
        responses: {
          200: { description: "Active plans" },
        },
      },
    },
  },
  async (ctx) => {
    const db = resolveAuthDatabase();
    const plans = await db
      .select()
      .from(schema.subscriptionPlans)
      .where(
        and(
          eq(schema.subscriptionPlans.isDeleted, false),
          eq(schema.subscriptionPlans.isActive, true)
        )
      )
      .orderBy(asc(schema.subscriptionPlans.amountInPaise));

    return ctx.json({ plans });
  }
);

export const subscriptionPlansPlugin = {
  id: "subscription-plans",
  endpoints: {
    listSubscriptionPlans: listPlansEndpoint,
    listActiveSubscriptionPlans: listActivePlansPublicEndpoint,
    getSubscriptionPlan: getPlanEndpoint,
    createSubscriptionPlan: createPlanEndpoint,
    updateSubscriptionPlan: updatePlanEndpoint,
    deleteSubscriptionPlan: deletePlanEndpoint,
  },
} satisfies BetterAuthPlugin;
