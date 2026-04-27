/** biome-ignore-all lint/suspicious/noExplicitAny: Better Auth and Razorpay contexts are runtime-shaped */
import * as crypto from "node:crypto";
import * as schema from "@proptryx/database";
import { getOrganizationSubscriptionLimits } from "@proptryx/database";
import { emailSubject, renderCompleteSubscriptionEmail, sendEmail } from "@proptryx/notification";
import { APIError, type BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { eq, and } from "drizzle-orm";
import {
  cancelSubscriptionBodySchema,
  createAuthorizedOrganizationMiddleware,
  createRazorpaySubscriptionWithLink,
  createSubscriptionBodySchema,
  ensureOrganizationWithCustomer,
  getCurrentSubscriptionQuerySchema,
  getLimitsQuerySchema,
  getOrganizationSubscriptionRecord,
  getOrganizationSubscriptionRecordByRazorpaySubscriptionId,
  getPlanById,
  getPlanByRazorpayPlanId,
  getPlanIncludedProperties,
  getRazorpayErrorMessage,
  isActiveSubscriptionStatus,
  normalizeStringRecord,
  pauseSubscriptionBodySchema,
  paymentStatusQuerySchema,
  resolveSubscriptionNotifyContacts,
  resumeSubscriptionBodySchema,
  rzClient,
  saveOrganizationSubscriptionRecord,
  SUBSCRIPTION_NOTIFICATION_CONFIG,
  syncSubscriptionBodySchema,
  toNullableNumber,
} from "./shared";
import { logger } from "@/lib/logger";
import { resolveAuthDatabase } from "../../auth/utils";

function getEffectivePlanAmountInPaise(plan: any) {
  if (
    plan?.discountedAmountInPaise &&
    plan.discountedAmountInPaise > 0 &&
    (!plan.discountAvailableTill || plan.discountAvailableTill >= new Date())
  ) {
    return plan.discountedAmountInPaise;
  }

  return plan?.amountInPaise ?? 0;
}

const createSubscriptionEndpoint = createAuthEndpoint(
  "/organization/subscription/create",
  {
    method: "POST",
    body: createSubscriptionBodySchema,
    use: [createAuthorizedOrganizationMiddleware((ctx) => ctx.body?.organizationId)],
    metadata: {
      openapi: {
        summary: "Create organization subscription",
        description: "Creates a Razorpay subscription and links it with organization_subscription",
        responses: {
          200: { description: "Subscription created" },
        },
      },
    },
  },
  async (ctx) => {
    const session = ctx.context.session as any;
    const organizationId = ctx.context.organizationId as string;

    const [plan, currentSubscription] = await Promise.all([
      getPlanById(ctx.body.subscriptionPlanId),
      getOrganizationSubscriptionRecord(organizationId),
    ]);

    if (!plan) {
      throw new APIError("BAD_REQUEST", {
        message: "Subscription plan not found.",
      });
    }

    if (!plan.isActive) {
      throw new APIError("BAD_REQUEST", {
        message: "Subscription plan is inactive.",
      });
    }

    if (currentSubscription && isActiveSubscriptionStatus(currentSubscription.status)) {
      throw new APIError("BAD_REQUEST", {
        message: "Organization already has an active or pending subscription.",
      });
    }

    const quantity = ctx.body.quantity ?? plan.quantity ?? 1;
    const totalCount = ctx.body.totalCount ?? plan.totalCount ?? 12;
    const customerNotifyRequested =
      ctx.body.customerNotify ?? SUBSCRIPTION_NOTIFICATION_CONFIG.defaultCustomerNotify;
    const notificationMode =
      ctx.body.notificationMode ?? (ctx.body.applicationNotifyOnly ? "application" : "auto");
    const applicationNotifyOnly = notificationMode === "application";
    const customerNotify = notificationMode === "application" ? false : customerNotifyRequested;
    const trialDaysApplied = ctx.body.trialDays ?? plan.trialDays ?? 0;
    const additionalProperties = ctx.body.additionalProperties ?? 0;
    const addonPropertyOneTimeCostInPaise =
      ctx.body.addonPropertyOneTimeCostInPaise ?? plan.addonPropertyOneTimeCostInPaise ?? 0;
    const addonOneTimeTotalInPaise = additionalProperties * addonPropertyOneTimeCostInPaise;
    const baseAmountInPaise = getEffectivePlanAmountInPaise(plan);

    if (additionalProperties > 0 && addonPropertyOneTimeCostInPaise <= 0) {
      throw new APIError("BAD_REQUEST", {
        message:
          "addonPropertyOneTimeCostInPaise must be greater than 0 when additionalProperties are provided.",
      });
    }

    const organization = await ensureOrganizationWithCustomer(organizationId, session.user);
    const requestedCustomerId = ctx.body.customerId?.trim() || organization.razorpayCustomerId;
    const { notifyEmail, notifyPhone } = resolveSubscriptionNotifyContacts({
      organizationEmail: organization.email,
      organizationPhoneNumber: organization.phoneNumber,
      sessionEmail: session.user.email,
      sessionPhoneNumber: session.user.phoneNumber,
    });

    const notes: Record<string, string> = {
      organizationId,
      subscriptionPlanId: plan.id,
      planCode: plan.code,
      requestedRazorpayCustomerId: requestedCustomerId,
      createdByUserId: session.user.id,
      baseAmountInPaise: String(baseAmountInPaise),
      listAmountInPaise: String(plan.amountInPaise),
      discountedAmountInPaise: String(plan.discountedAmountInPaise ?? ""),
      discountAvailableTill: plan.discountAvailableTill?.toISOString?.() ?? "",
      additionalProperties: String(additionalProperties),
      addonPropertyOneTimeCostInPaise: String(addonPropertyOneTimeCostInPaise),
      addonOneTimeTotalInPaise: String(addonOneTimeTotalInPaise),
      trialDaysApplied: String(trialDaysApplied),
      customerNotifyRequested: String(customerNotifyRequested),
      notificationMode,
      applicationNotifyOnly: String(applicationNotifyOnly),
      ...(ctx.body.notes ?? {}),
    };

    const createParams: any = {
      plan_id: plan.razorpayPlanId,
      quantity,
      total_count: totalCount,
      customer_notify: customerNotify,
      notes,
    };

    if ((notifyEmail || notifyPhone) && notificationMode !== "application") {
      createParams.notify_info = {
        ...(notifyEmail ? { notify_email: notifyEmail } : {}),
        ...(notifyPhone ? { notify_phone: notifyPhone } : {}),
      };
    }

    if (addonOneTimeTotalInPaise > 0) {
      createParams.addons = [
        {
          item: {
            name: `Additional properties (${additionalProperties})`,
            amount: addonOneTimeTotalInPaise,
            currency: String(plan.currency || "INR").toUpperCase(),
            description: "One-time add-on charge for additional properties",
          },
        },
      ];
    }

    let trialStart: Date | null = null;
    let trialEnd: Date | null = null;

    if (trialDaysApplied > 0) {
      trialStart = new Date();
      trialEnd = new Date(trialStart.getTime() + trialDaysApplied * 24 * 60 * 60 * 1000);
      createParams.start_at = Math.floor(trialEnd.getTime() / 1000);
      createParams.expire_by =
        Math.floor(Date.now() / 1000) +
        SUBSCRIPTION_NOTIFICATION_CONFIG.authLinkExpireWindowSeconds;
    }

    let razorpaySubscription: any;
    let paymentLink: string | null = null;

    try {
      const createResult = await createRazorpaySubscriptionWithLink(createParams);
      razorpaySubscription = createResult.razorpaySubscription;
      paymentLink = createResult.paymentLink;
    } catch (error) {
      const message = getRazorpayErrorMessage(error, "Failed to create Razorpay subscription.");
      logger.error("razorpay subscription creation failed", {
        organizationId,
        subscriptionPlanId: plan.id,
        message,
      });
      throw new APIError("BAD_REQUEST", { message });
    }

    if (!paymentLink) {
      logger.error("razorpay did not return a hosted payment link", {
        organizationId,
        subscriptionPlanId: plan.id,
        razorpaySubscriptionId: razorpaySubscription?.id,
      });
      throw new APIError("BAD_REQUEST", {
        message:
          "Razorpay did not return a hosted payment link for this subscription. Please verify mandate/payment settings in Razorpay dashboard.",
      });
    }

    const customerBindingApplied = Boolean(razorpaySubscription?.customer_id);
    const shouldSendFallbackEmail =
      notificationMode === "application" ||
      (notificationMode === "auto" && customerNotify && !customerBindingApplied);

    const fallbackEmailPromise: Promise<boolean> =
      notifyEmail && shouldSendFallbackEmail
        ? (async () => {
            try {
              await sendEmail({
                to: notifyEmail,
                subject: emailSubject["complete-subscription"].subject,
                html: await renderCompleteSubscriptionEmail({
                  organizationName: organization.name,
                  planName: plan.name,
                  previewText: emailSubject["complete-subscription"].previewText,
                  paymentLink,
                }),
              });
              return true;
            } catch {
              return false;
            }
          })()
        : Promise.resolve(false);

    const subscription = await saveOrganizationSubscriptionRecord({
      organizationId,
      razorpaySubscription,
      plan: { id: plan.id, code: plan.code },
      existing: currentSubscription,
      baseAmountInPaise,
      billingPeriod: plan.billingInterval,
      trialDaysApplied,
      additionalProperties,
      addonPropertyOneTimeCostInPaise,
      addonOneTimeTotalInPaise,
      trialStart,
      trialEnd,
      metadata: ctx.body.metadata ?? {},
      notes,
      razorpayCustomerId: requestedCustomerId,
    });

    const notificationSentByApp = await fallbackEmailPromise;

    return ctx.json({
      subscription,
      authorizeUrl: paymentLink,
      razorpayPaymentLink: paymentLink,
      customerBindingApplied,
      customerNotifyHandledBy: applicationNotifyOnly
        ? "application"
        : customerBindingApplied
          ? "razorpay"
          : "application",
      customerNotifyRequested,
      notificationMode,
      applicationNotifyOnly,
      razorpayCustomerNotify:
        razorpaySubscription?.customer_notify !== undefined
          ? Boolean(razorpaySubscription.customer_notify)
          : null,
      notificationSentByApp,
    });
  }
);

const currentSubscriptionEndpoint = createAuthEndpoint(
  "/organization/subscription/current",
  {
    method: "GET",
    query: getCurrentSubscriptionQuerySchema,
    use: [createAuthorizedOrganizationMiddleware((ctx) => ctx.query?.organizationId)],
    metadata: {
      openapi: {
        summary: "Get current organization subscription",
        description: "Returns latest subscription status and mapped plan for an organization",
        responses: {
          200: { description: "Current subscription" },
        },
      },
    },
  },
  async (ctx) => {
    const organizationId = ctx.context.organizationId as string;
    const subscription = await getOrganizationSubscriptionRecord(organizationId);
    const plan = await getPlanById(subscription?.subscriptionPlanId ?? null);

    return ctx.json({ subscription, plan });
  }
);

const limitsEndpoint = createAuthEndpoint(
  "/organization/subscription/limits",
  {
    method: "GET",
    query: getLimitsQuerySchema,
    use: [createAuthorizedOrganizationMiddleware((ctx) => ctx.query?.organizationId)],
    metadata: {
      openapi: {
        summary: "Get organization plan limits and usage",
        description:
          "Returns feature-based limits with total, used, left, available, and unlimited values for every numeric subscription-plan feature.",
        responses: {
          200: { description: "Plan limits and usage" },
        },
      },
    },
  },
  async (ctx) => {
    const organizationId = ctx.context.organizationId as string;
    const limits = await getOrganizationSubscriptionLimits(organizationId);

    return ctx.json({
      subscription: limits.subscription,
      plan: limits.plan,
      features: limits.features,
    });
  }
);

const syncSubscriptionEndpoint = createAuthEndpoint(
  "/organization/subscription/sync",
  {
    method: "POST",
    body: syncSubscriptionBodySchema,
    use: [createAuthorizedOrganizationMiddleware((ctx) => ctx.body?.organizationId)],
    metadata: {
      openapi: {
        summary: "Sync organization subscription",
        description: "Fetches latest state from Razorpay and updates organization_subscription",
        responses: {
          200: { description: "Subscription synced" },
        },
      },
    },
  },
  async (ctx) => {
    const organizationId = ctx.context.organizationId as string;
    const subscription = await getOrganizationSubscriptionRecord(organizationId);

    if (!subscription?.razorpaySubscriptionId) {
      throw new APIError("BAD_REQUEST", {
        message: "No Razorpay subscription is linked with this organization.",
      });
    }

    const razorpaySubscription = await rzClient.subscriptions.fetch(
      subscription.razorpaySubscriptionId
    );
    const linkedPlan = await getPlanByRazorpayPlanId(razorpaySubscription.plan_id);

    const syncedSubscription = await saveOrganizationSubscriptionRecord({
      organizationId,
      razorpaySubscription,
      plan: linkedPlan ? { id: linkedPlan.id, code: linkedPlan.code } : null,
      existing: subscription,
      fallbackPlanCode: linkedPlan?.code ?? subscription.planCode,
      baseAmountInPaise: subscription.baseAmountInPaise,
      billingPeriod: subscription.billingPeriod,
      trialDaysApplied: subscription.trialDaysApplied,
      additionalProperties: subscription.additionalProperties,
      addonPropertyOneTimeCostInPaise: subscription.addonPropertyOneTimeCostInPaise,
      addonOneTimeTotalInPaise: subscription.addonOneTimeTotalInPaise,
      metadata: subscription.metadata ?? {},
      notes: subscription.notes ?? {},
      trialStart: subscription.trialStart,
      trialEnd: subscription.trialEnd,
      razorpayCustomerId: subscription.razorpayCustomerId,
    });

    return ctx.json({ subscription: syncedSubscription });
  }
);

const cancelSubscriptionEndpoint = createAuthEndpoint(
  "/organization/subscription/cancel",
  {
    method: "POST",
    body: cancelSubscriptionBodySchema,
    use: [createAuthorizedOrganizationMiddleware((ctx) => ctx.body?.organizationId)],
    metadata: {
      openapi: {
        summary: "Cancel organization subscription",
        description: "Cancels Razorpay subscription and updates local organization_subscription",
        responses: {
          200: { description: "Subscription cancelled" },
        },
      },
    },
  },
  async (ctx) => {
    const organizationId = ctx.context.organizationId as string;
    const subscription = await getOrganizationSubscriptionRecord(organizationId);

    if (!subscription?.razorpaySubscriptionId) {
      throw new APIError("BAD_REQUEST", {
        message: "No Razorpay subscription is linked with this organization.",
      });
    }

    const cancelAtCycleEnd = ctx.body.cancelAtCycleEnd ?? true;
    const razorpaySubscription = await rzClient.subscriptions.cancel(
      subscription.razorpaySubscriptionId,
      cancelAtCycleEnd
    );
    const linkedPlan = await getPlanById(subscription.subscriptionPlanId);

    const cancelledSubscription = await saveOrganizationSubscriptionRecord({
      organizationId,
      razorpaySubscription,
      plan: linkedPlan ? { id: linkedPlan.id, code: linkedPlan.code } : null,
      existing: subscription,
      fallbackPlanCode: linkedPlan?.code ?? subscription.planCode,
      baseAmountInPaise: subscription.baseAmountInPaise,
      billingPeriod: subscription.billingPeriod,
      trialDaysApplied: subscription.trialDaysApplied,
      additionalProperties: subscription.additionalProperties,
      addonPropertyOneTimeCostInPaise: subscription.addonPropertyOneTimeCostInPaise,
      addonOneTimeTotalInPaise: subscription.addonOneTimeTotalInPaise,
      metadata: subscription.metadata ?? {},
      notes: subscription.notes ?? {},
      trialStart: subscription.trialStart,
      trialEnd: subscription.trialEnd,
      razorpayCustomerId: subscription.razorpayCustomerId,
    });

    return ctx.json({ subscription: cancelledSubscription });
  }
);

const pauseSubscriptionEndpoint = createAuthEndpoint(
  "/organization/subscription/pause",
  {
    method: "POST",
    body: pauseSubscriptionBodySchema,
    use: [createAuthorizedOrganizationMiddleware((ctx) => ctx.body?.organizationId)],
    metadata: {
      openapi: {
        summary: "Pause organization subscription",
        description: "Pauses Razorpay subscription and updates local organization_subscription",
        responses: {
          200: { description: "Subscription paused" },
        },
      },
    },
  },
  async (ctx) => {
    const organizationId = ctx.context.organizationId as string;
    const subscription = await getOrganizationSubscriptionRecord(organizationId);

    if (!subscription?.razorpaySubscriptionId) {
      throw new APIError("BAD_REQUEST", {
        message: "No Razorpay subscription is linked with this organization.",
      });
    }

    const pauseAt = ctx.body.pauseAt ?? "now";
    const razorpaySubscription = await rzClient.subscriptions.pause(
      subscription.razorpaySubscriptionId,
      { pause_at: pauseAt }
    );
    const linkedPlan = await getPlanById(subscription.subscriptionPlanId);

    const pausedSubscription = await saveOrganizationSubscriptionRecord({
      organizationId,
      razorpaySubscription,
      plan: linkedPlan ? { id: linkedPlan.id, code: linkedPlan.code } : null,
      existing: subscription,
      fallbackPlanCode: linkedPlan?.code ?? subscription.planCode,
      baseAmountInPaise: subscription.baseAmountInPaise,
      billingPeriod: subscription.billingPeriod,
      trialDaysApplied: subscription.trialDaysApplied,
      additionalProperties: subscription.additionalProperties,
      addonPropertyOneTimeCostInPaise: subscription.addonPropertyOneTimeCostInPaise,
      addonOneTimeTotalInPaise: subscription.addonOneTimeTotalInPaise,
      metadata: subscription.metadata ?? {},
      notes: subscription.notes ?? {},
      trialStart: subscription.trialStart,
      trialEnd: subscription.trialEnd,
      razorpayCustomerId: subscription.razorpayCustomerId,
    });

    return ctx.json({ subscription: pausedSubscription });
  }
);

const resumeSubscriptionEndpoint = createAuthEndpoint(
  "/organization/subscription/resume",
  {
    method: "POST",
    body: resumeSubscriptionBodySchema,
    use: [createAuthorizedOrganizationMiddleware((ctx) => ctx.body?.organizationId)],
    metadata: {
      openapi: {
        summary: "Resume organization subscription",
        description: "Resumes Razorpay subscription and updates local organization_subscription",
        responses: {
          200: { description: "Subscription resumed" },
        },
      },
    },
  },
  async (ctx) => {
    const organizationId = ctx.context.organizationId as string;
    const subscription = await getOrganizationSubscriptionRecord(organizationId);

    if (!subscription?.razorpaySubscriptionId) {
      throw new APIError("BAD_REQUEST", {
        message: "No Razorpay subscription is linked with this organization.",
      });
    }

    const resumeAt = ctx.body.resumeAt ?? "now";
    const razorpaySubscription = await rzClient.subscriptions.resume(
      subscription.razorpaySubscriptionId,
      { resume_at: resumeAt }
    );
    const linkedPlan = await getPlanById(subscription.subscriptionPlanId);

    const resumedSubscription = await saveOrganizationSubscriptionRecord({
      organizationId,
      razorpaySubscription,
      plan: linkedPlan ? { id: linkedPlan.id, code: linkedPlan.code } : null,
      existing: subscription,
      fallbackPlanCode: linkedPlan?.code ?? subscription.planCode,
      baseAmountInPaise: subscription.baseAmountInPaise,
      billingPeriod: subscription.billingPeriod,
      trialDaysApplied: subscription.trialDaysApplied,
      additionalProperties: subscription.additionalProperties,
      addonPropertyOneTimeCostInPaise: subscription.addonPropertyOneTimeCostInPaise,
      addonOneTimeTotalInPaise: subscription.addonOneTimeTotalInPaise,
      metadata: subscription.metadata ?? {},
      notes: subscription.notes ?? {},
      trialStart: subscription.trialStart,
      trialEnd: subscription.trialEnd,
      razorpayCustomerId: subscription.razorpayCustomerId,
    });

    return ctx.json({ subscription: resumedSubscription });
  }
);

const paymentStatusEndpoint = createAuthEndpoint(
  "/organization/subscription/payment-status",
  {
    method: "GET",
    query: paymentStatusQuerySchema,
    use: [createAuthorizedOrganizationMiddleware((ctx) => ctx.query?.organizationId)],
    metadata: {
      openapi: {
        operationId: "getOrganizationSubscriptionPaymentStatus",
        summary: "Poll subscription payment status",
        description:
          "Lightweight single-JOIN polling endpoint. Returns payment confirmation state and minimal plan details without any Razorpay API calls. Call on an interval (e.g. every 3 s) after subscription creation to detect when isPaid flips to true.",
        tags: ["Organization-subscription"],
        parameters: [
          {
            name: "organizationId",
            in: "query" as const,
            required: false,
            schema: { type: "string" },
            description:
              "Target organization ID. Falls back to the session activeOrganizationId when omitted.",
          },
        ],
        responses: {
          200: {
            description: "Payment status resolved successfully",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: [
                    "status",
                    "isPaid",
                    "isActive",
                    "cancelAtCycleEnd",
                    "paidCount",
                    "razorpaySubscriptionId",
                    "shortUrl",
                    "plan",
                  ],
                  properties: {
                    status: {
                      type: "string",
                      nullable: true,
                      description:
                        "Razorpay subscription status or null if no subscription exists.",
                      enum: [
                        "created",
                        "authenticated",
                        "active",
                        "pending",
                        "halted",
                        "paused",
                        "cancelled",
                        "completed",
                        "expired",
                        null,
                      ],
                    },
                    isPaid: {
                      type: "boolean",
                      description:
                        "True when paidCount > 0 — at least one billing cycle has been paid.",
                    },
                    isActive: {
                      type: "boolean",
                      description:
                        "True when status is one of created | authenticated | active | pending | halted | paused.",
                    },
                    cancelAtCycleEnd: {
                      type: "boolean",
                      description:
                        "Whether the subscription will cancel at the end of the current billing cycle.",
                    },
                    paidCount: {
                      type: "integer",
                      minimum: 0,
                      description: "Number of billing cycles already paid.",
                    },
                    razorpaySubscriptionId: {
                      type: "string",
                      nullable: true,
                      description: "Razorpay subscription ID if one has been created.",
                    },
                    shortUrl: {
                      type: "string",
                      nullable: true,
                      description:
                        "Hosted payment / authentication link from Razorpay. Present until the mandate is authorised.",
                    },
                    plan: {
                      type: "object",
                      nullable: true,
                      description: "Minimal plan details. null when no plan is linked.",
                      required: [
                        "id",
                        "code",
                        "name",
                        "amountInPaise",
                        "discountedAmountInPaise",
                        "discountAvailableTill",
                        "currency",
                        "billingInterval",
                        "trialDays",
                      ],
                      properties: {
                        id: { type: "string" },
                        code: { type: "string" },
                        name: { type: "string" },
                        amountInPaise: {
                          type: "integer",
                          description: "Full list price in paise.",
                        },
                        discountedAmountInPaise: {
                          type: "integer",
                          nullable: true,
                          description: "Discounted price in paise, if a discount is configured.",
                        },
                        discountAvailableTill: {
                          type: "string",
                          format: "date-time",
                          nullable: true,
                          description: "ISO 8601 UTC datetime until which the discount is valid.",
                        },
                        currency: {
                          type: "string",
                          example: "INR",
                        },
                        billingInterval: {
                          type: "string",
                          enum: ["monthly", "yearly"],
                        },
                        trialDays: {
                          type: "integer",
                          minimum: 0,
                          description: "Number of trial days on this plan.",
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          401: { description: "Unauthenticated — valid session required." },
          403: {
            description:
              "Forbidden — the authenticated user is not a member of the requested organization.",
          },
        },
      },
    },
  },
  async (ctx) => {
    const organizationId = ctx.context.organizationId as string;
    const db = resolveAuthDatabase();

    const [row] = await db
      .select({
        status: schema.organizationSubscription.status,
        paidCount: schema.organizationSubscription.paidCount,
        cancelAtCycleEnd: schema.organizationSubscription.cancelAtCycleEnd,
        razorpaySubscriptionId: schema.organizationSubscription.razorpaySubscriptionId,
        shortUrl: schema.organizationSubscription.shortUrl,
        planId: schema.subscriptionPlans.id,
        planCode: schema.subscriptionPlans.code,
        planName: schema.subscriptionPlans.name,
        amountInPaise: schema.subscriptionPlans.amountInPaise,
        discountedAmountInPaise: schema.subscriptionPlans.discountedAmountInPaise,
        discountAvailableTill: schema.subscriptionPlans.discountAvailableTill,
        currency: schema.subscriptionPlans.currency,
        billingInterval: schema.subscriptionPlans.billingInterval,
        trialDays: schema.subscriptionPlans.trialDays,
      })
      .from(schema.organizationSubscription)
      .leftJoin(
        schema.subscriptionPlans,
        eq(schema.subscriptionPlans.id, schema.organizationSubscription.subscriptionPlanId)
      )
      .where(eq(schema.organizationSubscription.organizationId, organizationId))
      .limit(1);

    if (!row) {
      return ctx.json({
        status: null,
        isPaid: false,
        isActive: false,
        cancelAtCycleEnd: false,
        paidCount: 0,
        razorpaySubscriptionId: null,
        shortUrl: null,
        plan: null,
      });
    }

    const status = row.status;
    const isPaid = row.paidCount > 0;
    const isActive = isActiveSubscriptionStatus(status);

    return ctx.json({
      status,
      isPaid,
      isActive,
      cancelAtCycleEnd: row.cancelAtCycleEnd,
      paidCount: row.paidCount,
      razorpaySubscriptionId: row.razorpaySubscriptionId,
      shortUrl: row.shortUrl,
      plan: row.planId
        ? {
            id: row.planId,
            code: row.planCode,
            name: row.planName,
            amountInPaise: row.amountInPaise,
            discountedAmountInPaise: row.discountedAmountInPaise ?? null,
            discountAvailableTill: row.discountAvailableTill?.toISOString() ?? null,
            currency: row.currency,
            billingInterval: row.billingInterval,
            trialDays: row.trialDays,
          }
        : null,
    });
  }
);

const webhookEndpoint = createAuthEndpoint(
  "/organization/subscription/webhook",
  {
    method: "POST",
    metadata: {
      isAction: false,
      openapi: {
        summary: "Razorpay subscription webhook",
        description: "Verifies Razorpay signature and syncs organization_subscription status",
        responses: {
          200: { description: "Webhook processed" },
        },
      },
    },
  },
  async (ctx) => {
    const signature = ctx.request?.headers?.get("x-razorpay-signature");

    if (!signature) {
      throw new APIError("BAD_REQUEST", {
        message: "x-razorpay-signature header is required.",
      });
    }

    let rawBody = "";

    try {
      rawBody = await ctx.request!.text();
    } catch {
      rawBody = JSON.stringify(ctx.body ?? {});
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET || "")
      .update(rawBody)
      .digest("hex");

    const signatureBuffer = Buffer.from(signature, "utf8");
    const expectedBuffer = Buffer.from(expectedSignature, "utf8");

    const isValidSignature =
      signatureBuffer.length === expectedBuffer.length &&
      crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

    if (!isValidSignature) {
      throw new APIError("BAD_REQUEST", {
        message: "Invalid Razorpay webhook signature.",
      });
    }

    const event = JSON.parse(rawBody) as any;

    if (!event?.event || !String(event.event).startsWith("subscription.")) {
      return ctx.json({ received: true, ignored: true });
    }

    const razorpaySubscription = event?.payload?.subscription?.entity as any;

    if (!razorpaySubscription?.id) {
      return ctx.json({ received: true, ignored: true });
    }

    const notes = normalizeStringRecord(razorpaySubscription.notes);
    const existingSubscription = await getOrganizationSubscriptionRecordByRazorpaySubscriptionId(
      razorpaySubscription.id
    );
    const organizationId = notes.organizationId || existingSubscription?.organizationId || null;

    if (!organizationId) {
      return ctx.json({ received: true, ignored: true });
    }

    const db = resolveAuthDatabase();
    const [organization] = await db
      .select({ razorpayCustomerId: schema.organization.razorpayCustomerId })
      .from(schema.organization)
      .where(eq(schema.organization.id, organizationId))
      .limit(1);

    const linkedPlan = await getPlanByRazorpayPlanId(razorpaySubscription.plan_id);

    await saveOrganizationSubscriptionRecord({
      organizationId,
      razorpaySubscription,
      plan: linkedPlan ? { id: linkedPlan.id, code: linkedPlan.code } : null,
      existing: existingSubscription,
      fallbackPlanCode: linkedPlan?.code ?? notes.planCode ?? existingSubscription?.planCode,
      baseAmountInPaise:
        toNullableNumber(notes.baseAmountInPaise, existingSubscription?.baseAmountInPaise ?? 0) ??
        0,
      billingPeriod:
        existingSubscription?.billingPeriod ?? linkedPlan?.billingInterval ?? "monthly",
      trialDaysApplied:
        toNullableNumber(notes.trialDaysApplied, existingSubscription?.trialDaysApplied ?? 0) ?? 0,
      additionalProperties:
        toNullableNumber(
          notes.additionalProperties,
          existingSubscription?.additionalProperties ?? 0
        ) ?? 0,
      addonPropertyOneTimeCostInPaise:
        toNullableNumber(
          notes.addonPropertyOneTimeCostInPaise,
          existingSubscription?.addonPropertyOneTimeCostInPaise ?? 0
        ) ?? 0,
      addonOneTimeTotalInPaise:
        toNullableNumber(
          notes.addonOneTimeTotalInPaise,
          existingSubscription?.addonOneTimeTotalInPaise ?? 0
        ) ?? 0,
      metadata: existingSubscription?.metadata ?? {},
      notes,
      trialStart: existingSubscription?.trialStart,
      trialEnd: existingSubscription?.trialEnd,
      razorpayCustomerId: organization?.razorpayCustomerId,
    });

    return ctx.json({ received: true });
  }
);

export const organizationSubscriptionPlugin = {
  id: "organization-subscription",
  endpoints: {
    createOrganizationSubscription: createSubscriptionEndpoint,
    getCurrentOrganizationSubscription: currentSubscriptionEndpoint,
    getOrganizationSubscriptionLimits: limitsEndpoint,
    getOrganizationSubscriptionPaymentStatus: paymentStatusEndpoint,
    syncOrganizationSubscription: syncSubscriptionEndpoint,
    cancelOrganizationSubscription: cancelSubscriptionEndpoint,
    pauseOrganizationSubscription: pauseSubscriptionEndpoint,
    resumeOrganizationSubscription: resumeSubscriptionEndpoint,
    organizationSubscriptionWebhook: webhookEndpoint,
  },
} satisfies BetterAuthPlugin;
