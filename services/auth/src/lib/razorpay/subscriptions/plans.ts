/** biome-ignore-all lint/suspicious/noExplicitAny: Better Auth runtime context is runtime-shaped */
import * as schema from "@proptryx/database";
import type { SubscriptionPlanFeatures } from "@proptryx/database";
import { APIError, type BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { asc, eq } from "drizzle-orm";
import {
  createPlanBodySchema,
  deactivatePlanBodySchema,
  getPlanByCode,
  getPlanById,
  getPlanQuerySchema,
  normalizePlanCode,
  signedInSessionMiddleware,
  updatePlanBodySchema,
} from "./shared";
import { resolveAuthDatabase } from "../../auth/utils";
import { generateRandomId } from "@proptryx/utils";

const listPlansEndpoint = createAuthEndpoint(
  "/subscription/plans",
  {
    method: "GET",
    metadata: {
      openapi: {
        summary: "List active subscription plans",
        description: "Returns all active subscription plans ordered by price. Public endpoint.",
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
      .where(eq(schema.subscriptionPlans.isActive, true))
      .orderBy(asc(schema.subscriptionPlans.amountInPaise));

    return ctx.json({ plans });
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
      .where(eq(schema.subscriptionPlans.code, code))
      .limit(1);

    if (existing) {
      throw new APIError("BAD_REQUEST", {
        message: `A subscription plan with code "${code}" already exists. Use PATCH to update it.`,
      });
    }

    const now = new Date();

    const [plan] = await db
      .insert(schema.subscriptionPlans)
      .values({
        id: generateRandomId(),
        code,
        name: ctx.body.name,
        description: ctx.body.description || null,
        amountInPaise: ctx.body.amountInPaise,
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

    if (ctx.body.name !== undefined) updatePayload.name = ctx.body.name;
    if (ctx.body.description !== undefined) updatePayload.description = ctx.body.description;
    if (ctx.body.amountInPaise !== undefined) updatePayload.amountInPaise = ctx.body.amountInPaise;
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

    const [updated] = await db
      .update(schema.subscriptionPlans)
      .set(updatePayload as any)
      .where(eq(schema.subscriptionPlans.id, existing.id))
      .returning();

    return ctx.json({ plan: updated });
  }
);

const deactivatePlanEndpoint = createAuthEndpoint(
  "/subscription/plan",
  {
    method: "DELETE",
    body: deactivatePlanBodySchema,
    use: [signedInSessionMiddleware],
    metadata: {
      openapi: {
        summary: "Deactivate a subscription plan",
        description: "Sets isActive=false on the plan. Does not delete existing subscriptions.",
        responses: {
          200: { description: "Plan deactivated" },
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

    const [updated] = await db
      .update(schema.subscriptionPlans)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(schema.subscriptionPlans.id, existing.id))
      .returning();

    return ctx.json({ plan: updated });
  }
);

export const subscriptionPlansPlugin = {
  id: "subscription-plans",
  endpoints: {
    listSubscriptionPlans: listPlansEndpoint,
    getSubscriptionPlan: getPlanEndpoint,
    createSubscriptionPlan: createPlanEndpoint,
    updateSubscriptionPlan: updatePlanEndpoint,
    deactivateSubscriptionPlan: deactivatePlanEndpoint,
  },
} satisfies BetterAuthPlugin;
