/** biome-ignore-all lint/style/useConst: forced */
import { APIError } from "better-auth";
import type { BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, sessionMiddleware } from "better-auth/api";
import { subscription as subscriptionTable, subscriptionPlan } from "@proptryx/database";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { type UserFields, userFields } from "./fields/user";
import { rzClient } from "../razorpay/client";
import { razorpay } from "better-auth-razorpay";
import { env } from "@/config/env";
import { resolveAuthDatabase } from "./utils";

export const allowCustomInputFieldsPlugin = {
  id: "allow-custom-input-fields",
  schema: {
    user: {
      fields: Array.isArray(userFields)
        ? Object.fromEntries(
            userFields.map((field: UserFields) => [
              field.name,
              {
                type: field.type,
                input: field.input,
                required: field.required,
                fieldName: field.fieldName,
              },
            ])
          )
        : userFields,
    },
  },
} satisfies BetterAuthPlugin;

const subscriptionLinkBodySchema = z.object({
  planId: z.string(),
  totalCount: z.number().optional(),
  quantity: z.number().optional(),
  expireBy: z.number().optional(),
  startAt: z.number().optional(),
  customerNotify: z.boolean().optional(),
  notifyEmail: z.string().email().optional(),
  notifyPhone: z.string().optional(),
  notes: z.record(z.string(), z.string()).optional(),
});

const createSubscriptionLink = createAuthEndpoint(
  "/razorpay/subscription-link",
  {
    method: "POST",
    body: subscriptionLinkBodySchema,
    metadata: {
      openapi: {
        summary: "Create subscription link",
        description: "Create a Razorpay subscription link with reference notes",
        responses: { 200: { description: "Subscription link created" } },
      },
    },
    use: [sessionMiddleware],
  },
  async (ctx) => {
    const session = ctx.context.session as {
      session: { activeOrganizationId?: string | null };
      user: { id: string; razorpayCustomerId?: string | null };
    };
    const user = session.user;

    const customerType = session.session.activeOrganizationId ? "organization" : "user";
    const referenceId =
      customerType === "organization" ? session.session.activeOrganizationId : user.id;

    if (!referenceId) {
      throw new APIError(400, {
        body: {
          message: "Organization referenceId is required for organization subscriptions.",
          code: "ORGANIZATION_REFERENCE_ID_REQUIRED",
        },
      });
    }

    let razorpayCustomerId: string | null | undefined = user.razorpayCustomerId;
    let notifyEmail: string | undefined;
    let notifyPhone: string | undefined;
    let notifyName: string | undefined;

    if (customerType === "organization") {
      const org = await ctx.context.adapter.findOne({
        model: "organization",
        where: [{ field: "id", value: referenceId }],
      });
      const orgData = org as {
        razorpayCustomerId?: string | null;
        email?: string | null;
        phoneNumber?: string | null;
      } | null;
      razorpayCustomerId = orgData?.razorpayCustomerId;
      notifyEmail = orgData?.email ?? undefined;
      notifyPhone = orgData?.phoneNumber ?? undefined;
      if (!razorpayCustomerId) {
        throw new APIError(400, {
          body: {
            message:
              "Organization Razorpay customer ID is missing. Create the Razorpay customer first.",
            code: "ORGANIZATION_CUSTOMER_ID_REQUIRED",
          },
        });
      }
    }

    const notes = {
      ...(ctx.body.notes ?? {}),
      referenceId,
      userId: user.id,
    };

    const userWithDetails = user as {
      email?: string | null;
      phoneNumber?: string | null;
      name?: string | null;
    };
    notifyEmail ??= userWithDetails.email ?? undefined;
    notifyPhone ??= userWithDetails.phoneNumber ?? undefined;
    notifyName ??= userWithDetails.name ?? undefined;

    const db = resolveAuthDatabase();
    let [planRow] = await db
      .select()
      .from(subscriptionPlan)
      .where(eq(subscriptionPlan.id, ctx.body.planId))
      .limit(1);

    if (!planRow) {
      [planRow] = await db
        .select()
        .from(subscriptionPlan)
        .where(eq(subscriptionPlan.rzPlanId, ctx.body.planId))
        .limit(1);
    }

    if (!planRow) {
      throw new APIError(400, {
        body: {
          message: "Subscription plan not found.",
          code: "SUBSCRIPTION_PLAN_NOT_FOUND",
        },
      });
    }

    const totalCount = ctx.body.totalCount ?? planRow.totalCount ?? 0;
    if (totalCount <= 0) {
      throw new APIError(400, {
        body: {
          message: "totalCount must be greater than 0.",
          code: "TOTAL_COUNT_REQUIRED",
        },
      });
    }
    const quantity = ctx.body.quantity ?? planRow.quantity ?? 1;

    const notifyInfo =
      ctx.body.notifyEmail || ctx.body.notifyPhone || notifyEmail || notifyPhone || notifyName
        ? {
            name: notifyName,
            email: ctx.body.notifyEmail ?? notifyEmail,
            contact: ctx.body.notifyPhone ?? notifyPhone,
          }
        : undefined;

    const razorpaySub = (await (
      rzClient as { api: { post: (input: unknown) => Promise<unknown> } }
    ).api.post({
      url: "/subscriptions",
      data: {
        plan_id: planRow.rzPlanId,
        total_count: totalCount,
        quantity,
        expire_by: ctx.body.expireBy,
        start_at: ctx.body.startAt,
        customer_notify: ctx.body.customerNotify ?? true,
        ...(notifyInfo ? { notify_info: notifyInfo } : {}),
        ...(razorpayCustomerId ? { customer_id: razorpayCustomerId } : {}),
        notes,
      },
    })) as {
      id: string;
      customer_id?: string | null;
      status?: string | null;
      quantity?: number | null;
      total_count?: number | null;
      short_url?: string | null;
    };

    const existing = (await ctx.context.adapter.findOne({
      model: "subscription",
      where: [{ field: "razorpaySubscriptionId", value: razorpaySub.id }],
    })) as { id: string } | null;

    const planName = planRow.name;
    const subscriptionData = {
      plan: planName.toLowerCase(),
      planId: planRow.id,
      referenceId,
      razorpayCustomerId: razorpaySub.customer_id ?? razorpayCustomerId ?? null,
      razorpaySubscriptionId: razorpaySub.id,
      razorpayPlanId: planRow.rzPlanId,
      status: razorpaySub.status ?? "created",
      quantity: razorpaySub.quantity ?? quantity,
      totalCount: razorpaySub.total_count ?? totalCount,
      shortUrl: razorpaySub.short_url ?? null,
      updatedAt: new Date(),
    };

    const subscription = existing
      ? await ctx.context.adapter.update({
          model: "subscription",
          update: subscriptionData,
          where: [{ field: "id", value: existing.id }],
        })
      : await ctx.context.adapter.create({
          model: "subscription",
          data: subscriptionData,
        });

    // Ensure planId is persisted even if adapter schema isn't updated yet.
    await db
      .update(subscriptionTable)
      .set({ planId: planRow.id })
      .where(eq(subscriptionTable.razorpaySubscriptionId, razorpaySub.id));

    return ctx.json({
      subscriptionId: razorpaySub.id,
      shortUrl: razorpaySub.short_url,
      subscription,
      razorpaySubscription: razorpaySub,
    });
  }
);

const baseRazorpayPlugin = razorpay({
  razorpayClient: rzClient,
  razorpayWebhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  createCustomerOnSignUp: false,
  schema: {
    subscription: {
      fields: {
        planId: {
          type: "string",
          required: false,
        },
      },
    },
  } as unknown as Parameters<typeof razorpay>[0]["schema"],
  organization: {
    enabled: true,
  },
  subscription: {
    enabled: true,
    requireEmailVerification: false,
    plans: async () => {
      const db = resolveAuthDatabase();
      const rows = await db
        .select()
        .from(subscriptionPlan)
        .where(eq(subscriptionPlan.isActive, true));

      return rows.map((plan) => ({
        planId: plan.rzPlanId,
        annualPlanId: plan.rzAnnualPlanId ?? undefined,
        name: plan.name,
        limits: plan.features ?? undefined,
        totalCount: plan.totalCount ?? undefined,
        quantity: plan.quantity ?? undefined,
        freeTrial: plan.freeTrialDays
          ? {
              days: plan.freeTrialDays,
            }
          : undefined,
      }));
    },
  },
  authorizeReference: async () => true,
});

const customRazorpayPlugin = {
  ...baseRazorpayPlugin,
  endpoints: {
    ...baseRazorpayPlugin.endpoints,
    createSubscriptionLink,
  },
} as unknown as BetterAuthPlugin;

export const razorpayPlugin = customRazorpayPlugin;
