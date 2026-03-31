/** biome-ignore-all lint/suspicious/noExplicitAny: Better Auth and Razorpay contexts are runtime-shaped */
import * as crypto from "node:crypto";
import * as schema from "@proptryx/database";
import { emailSubject, renderCompleteSubscriptionEmail, sendEmail } from "@proptryx/notification";
import { generateRandomId, getRazorpayClient } from "@proptryx/utils";
import { APIError, type BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint, createAuthMiddleware, sessionMiddleware } from "better-auth/api";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { logger } from "@/lib/logger";
import { resolveAuthDatabase } from "../auth/utils";

const rzClient = getRazorpayClient();

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "created",
  "authenticated",
  "active",
  "pending",
  "halted",
  "paused",
]);

const SUBSCRIPTION_NOTIFICATION_CONFIG = {
  defaultCustomerNotify: true,
  authLinkExpireWindowSeconds: 24 * 60 * 60,
} as const;

type SubscriptionNotificationContactInput = {
  organizationEmail?: string | null;
  organizationPhoneNumber?: string | null;
  sessionEmail?: string | null;
  sessionPhoneNumber?: string | null;
};

const upsertPlanBodySchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  description: z.string().optional(),
  amountInPaise: z.number().int().positive(),
  currency: z.string().min(3).default("INR"),
  billingInterval: z.enum(["monthly", "yearly"]).default("monthly"),
  razorpayPlanId: z.string().min(1),
  totalCount: z.number().int().positive().optional(),
  quantity: z.number().int().positive().optional(),
  trialDays: z.number().int().min(0).optional(),
  includedProperties: z.number().int().min(0).optional(),
  addonPropertyOneTimeCostInPaise: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  features: z.record(z.string(), z.unknown()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const createSubscriptionBodySchema = z.object({
  organizationId: z.string().optional(),
  subscriptionPlanId: z.string().min(1),
  customerId: z.string().min(1).optional(),
  quantity: z.number().int().positive().optional(),
  totalCount: z.number().int().positive().optional(),
  trialDays: z.number().int().min(0).optional(),
  additionalProperties: z.number().int().min(0).optional(),
  addonPropertyOneTimeCostInPaise: z.number().int().min(0).optional(),
  customerNotify: z.boolean().optional(),
  notificationMode: z.enum(["auto", "razorpay", "application"]).optional(),
  applicationNotifyOnly: z.boolean().optional(),
  notes: z.record(z.string(), z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const cancelSubscriptionBodySchema = z.object({
  organizationId: z.string().optional(),
  cancelAtCycleEnd: z.boolean().optional(),
});

const pauseSubscriptionBodySchema = z.object({
  organizationId: z.string().optional(),
  pauseAt: z.enum(["now"]).optional(),
});

const resumeSubscriptionBodySchema = z.object({
  organizationId: z.string().optional(),
  resumeAt: z.enum(["now"]).optional(),
});

const syncSubscriptionBodySchema = z.object({
  organizationId: z.string().optional(),
});

const getCurrentSubscriptionQuerySchema = z.object({
  organizationId: z.string().optional(),
});

const signedInSessionMiddleware = createAuthMiddleware(
  {
    use: [sessionMiddleware],
  },
  async (ctx) => {
    const session = ctx.context.session as any;

    if (!session?.user?.id) {
      throw new APIError("UNAUTHORIZED", {
        message: "Authentication required.",
      });
    }

    return {
      session,
    };
  }
);

function normalizePlanCode(planCode: string) {
  return planCode.trim().toLowerCase();
}

function toDateFromUnix(unixValue?: number | string | null) {
  if (unixValue === null || unixValue === undefined) {
    return null;
  }

  const numericValue = typeof unixValue === "string" ? Number(unixValue) : unixValue;

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return new Date(numericValue * 1000);
}

function toNullableNumber(value: unknown, fallback: number | null = null) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function normalizeStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry) => typeof entry[1] === "string")
      .map((entry) => [entry[0], String(entry[1])])
  );
}

function getRazorpayErrorMessage(error: unknown, fallback: string) {
  if (typeof error === "object" && error !== null) {
    const asRecord = error as Record<string, unknown>;
    const directMessage = asRecord.message;

    if (typeof directMessage === "string" && directMessage.length > 0) {
      return directMessage;
    }

    const nested = asRecord.error;
    if (typeof nested === "object" && nested !== null) {
      const nestedRecord = nested as Record<string, unknown>;
      const description = nestedRecord.description;
      const reason = nestedRecord.reason;

      if (typeof description === "string" && description.length > 0) {
        return description;
      }

      if (typeof reason === "string" && reason.length > 0) {
        return reason;
      }
    }
  }

  return fallback;
}

async function createRazorpaySubscriptionWithLink(createParams: any) {
  const razorpaySubscription: any = await (rzClient.subscriptions.create as any)(createParams);

  let paymentLink = razorpaySubscription.short_url || null;

  // Fetch only when create response does not include short_url.
  if (!paymentLink && razorpaySubscription?.id) {
    try {
      const latestSubscription: any = await (rzClient.subscriptions.fetch as any)(
        razorpaySubscription.id
      );
      paymentLink = latestSubscription.short_url || paymentLink;
    } catch {
      // Non-blocking: keep original short_url from create response.
    }
  }

  return {
    razorpaySubscription,
    paymentLink,
  };
}

function normalizeContactForNotify(value?: string | null) {
  if (!value) {
    return null;
  }

  const digits = value.replace(/\D/g, "");
  return digits.length > 0 ? digits : null;
}

function resolveSubscriptionNotifyContacts(input: SubscriptionNotificationContactInput) {
  const notifyEmail = input.organizationEmail || input.sessionEmail || null;
  const notifyPhone = normalizeContactForNotify(
    input.organizationPhoneNumber || input.sessionPhoneNumber || null
  );

  return {
    notifyEmail,
    notifyPhone,
  };
}

async function resolveOrganizationId(session: any, explicitOrganizationId?: string) {
  const organizationId = explicitOrganizationId || session?.session?.activeOrganizationId;

  if (!organizationId) {
    throw new APIError("BAD_REQUEST", {
      message: "organizationId is required or set an active organization first.",
    });
  }

  return organizationId;
}

async function assertOrganizationAccess(userId: string, organizationId: string) {
  const db = resolveAuthDatabase();
  const [membership] = await db
    .select({ id: schema.member.id })
    .from(schema.member)
    .where(and(eq(schema.member.userId, userId), eq(schema.member.organizationId, organizationId)))
    .limit(1);

  if (!membership) {
    throw new APIError("FORBIDDEN", {
      message: "You are not a member of this organization.",
    });
  }
}

async function getPlanById(planId: string | null | undefined) {
  if (!planId) {
    return null;
  }

  const db = resolveAuthDatabase();
  const [plan] = await db
    .select()
    .from(schema.subscriptionPlans)
    .where(eq(schema.subscriptionPlans.id, planId))
    .limit(1);

  return plan ?? null;
}

async function getPlanByRazorpayPlanId(razorpayPlanId: string) {
  const db = resolveAuthDatabase();
  const [plan] = await db
    .select()
    .from(schema.subscriptionPlans)
    .where(eq(schema.subscriptionPlans.razorpayPlanId, razorpayPlanId))
    .limit(1);

  return plan ?? null;
}

async function ensureOrganizationWithCustomer(organizationId: string, sessionUser: any) {
  const db = resolveAuthDatabase();
  const [organization] = await db
    .select({
      id: schema.organization.id,
      name: schema.organization.name,
      email: schema.organization.email,
      phoneNumber: schema.organization.phoneNumber,
      gstNumber: schema.organization.gstNumber,
      razorpayCustomerId: schema.organization.razorpayCustomerId,
    })
    .from(schema.organization)
    .where(eq(schema.organization.id, organizationId))
    .limit(1);

  if (!organization) {
    throw new APIError("BAD_REQUEST", {
      message: "Organization not found.",
    });
  }

  if (organization.razorpayCustomerId) {
    return {
      ...organization,
      razorpayCustomerId: organization.razorpayCustomerId,
    };
  }

  const customer = await rzClient.customers.create({
    name: organization.name,
    email: organization.email || sessionUser.email,
    contact: organization.phoneNumber || sessionUser.phoneNumber,
    gstin: organization.gstNumber || undefined,
    notes: {
      organizationId,
      createdByUserId: sessionUser.id,
      createdAt: new Date().toISOString(),
    },
  });

  await db
    .update(schema.organization)
    .set({
      razorpayCustomerId: customer.id,
    })
    .where(eq(schema.organization.id, organizationId));

  return {
    ...organization,
    razorpayCustomerId: customer.id,
  };
}

function isActiveSubscriptionStatus(status: string | null | undefined) {
  if (!status) {
    return false;
  }

  return ACTIVE_SUBSCRIPTION_STATUSES.has(status.toLowerCase());
}

async function upsertOrganizationSubscription(params: {
  organizationId: string;
  razorpaySubscription: any;
  plan: {
    id: string;
    code: string;
  } | null;
  fallbackPlanCode?: string;
  baseAmountInPaise?: number;
  billingPeriod?: string;
  trialDaysApplied?: number;
  includedProperties?: number;
  additionalProperties?: number;
  addonPropertyOneTimeCostInPaise?: number;
  addonOneTimeTotalInPaise?: number;
  trialStart?: Date | null;
  trialEnd?: Date | null;
  metadata?: Record<string, unknown>;
  notes?: Record<string, string>;
  razorpayCustomerId?: string | null;
}) {
  const db = resolveAuthDatabase();

  const [existing] = await db
    .select()
    .from(schema.organizationSubscription)
    .where(eq(schema.organizationSubscription.organizationId, params.organizationId))
    .limit(1);

  const resolvedCustomerId =
    params.razorpaySubscription.customer_id ||
    params.razorpayCustomerId ||
    existing?.razorpayCustomerId ||
    null;

  if (!resolvedCustomerId) {
    throw new APIError("BAD_REQUEST", {
      message: "Razorpay customer id is missing for organization subscription.",
    });
  }

  const resolvedStatus = String(params.razorpaySubscription.status || "created").toLowerCase();
  const resolvedEndedAt = toDateFromUnix(params.razorpaySubscription.ended_at);

  const payload = {
    subscriptionPlanId: params.plan?.id ?? existing?.subscriptionPlanId ?? null,
    planCode: params.plan?.code ?? params.fallbackPlanCode ?? existing?.planCode ?? "custom",
    razorpayCustomerId: resolvedCustomerId,
    razorpaySubscriptionId: params.razorpaySubscription.id,
    razorpayPlanId: params.razorpaySubscription.plan_id,
    status: resolvedStatus,
    quantity: toNullableNumber(params.razorpaySubscription.quantity, existing?.quantity ?? 1) ?? 1,
    totalCount: toNullableNumber(params.razorpaySubscription.total_count, existing?.totalCount),
    paidCount:
      toNullableNumber(params.razorpaySubscription.paid_count, existing?.paidCount ?? 0) ?? 0,
    remainingCount: toNullableNumber(
      params.razorpaySubscription.remaining_count,
      existing?.remainingCount
    ),
    baseAmountInPaise: params.baseAmountInPaise ?? existing?.baseAmountInPaise ?? 0,
    billingPeriod: params.billingPeriod ?? existing?.billingPeriod ?? "monthly",
    trialDaysApplied: params.trialDaysApplied ?? existing?.trialDaysApplied ?? 0,
    includedProperties: params.includedProperties ?? existing?.includedProperties ?? 0,
    additionalProperties: params.additionalProperties ?? existing?.additionalProperties ?? 0,
    addonPropertyOneTimeCostInPaise:
      params.addonPropertyOneTimeCostInPaise ?? existing?.addonPropertyOneTimeCostInPaise ?? 0,
    addonOneTimeTotalInPaise:
      params.addonOneTimeTotalInPaise ?? existing?.addonOneTimeTotalInPaise ?? 0,
    currentStart: toDateFromUnix(params.razorpaySubscription.current_start),
    currentEnd: toDateFromUnix(params.razorpaySubscription.current_end),
    trialStart: params.trialStart ?? existing?.trialStart ?? null,
    trialEnd: params.trialEnd ?? existing?.trialEnd ?? null,
    endedAt: resolvedEndedAt,
    cancelledAt:
      resolvedStatus === "cancelled"
        ? resolvedEndedAt || new Date()
        : (existing?.cancelledAt ?? null),
    pausedAt: resolvedStatus === "paused" ? new Date() : (existing?.pausedAt ?? null),
    shortUrl: params.razorpaySubscription.short_url || existing?.shortUrl || null,
    cancelAtCycleEnd: Boolean(params.razorpaySubscription.has_scheduled_changes),
    metadata: params.metadata ?? existing?.metadata ?? {},
    notes: params.notes ?? existing?.notes ?? {},
    updatedAt: new Date(),
  };

  if (existing) {
    const [updated] = await db
      .update(schema.organizationSubscription)
      .set(payload)
      .where(eq(schema.organizationSubscription.id, existing.id))
      .returning();

    return updated ?? existing;
  }

  const createdAt = new Date();

  const [created] = await db
    .insert(schema.organizationSubscription)
    .values({
      id: generateRandomId(),
      organizationId: params.organizationId,
      ...payload,
      createdAt,
      updatedAt: createdAt,
    })
    .returning();

  return created;
}

async function getOrganizationSubscription(organizationId: string) {
  const db = resolveAuthDatabase();
  const [subscription] = await db
    .select()
    .from(schema.organizationSubscription)
    .where(eq(schema.organizationSubscription.organizationId, organizationId))
    .limit(1);

  return subscription ?? null;
}

const listPlansEndpoint = createAuthEndpoint(
  "/organization/subscription/plans",
  {
    method: "GET",
    metadata: {
      openapi: {
        summary: "List active subscription plans",
        description: "Returns all active plans mapped to Razorpay plan ids",
        responses: {
          200: {
            description: "Active plans",
          },
        },
      },
    },
    use: [signedInSessionMiddleware],
  },
  async (ctx) => {
    const db = resolveAuthDatabase();
    const plans = await db
      .select()
      .from(schema.subscriptionPlans)
      .where(eq(schema.subscriptionPlans.isActive, true))
      .orderBy(asc(schema.subscriptionPlans.amountInPaise));

    return ctx.json({
      plans,
    });
  }
);

const upsertPlanEndpoint = createAuthEndpoint(
  "/organization/subscription/plan/upsert",
  {
    method: "POST",
    body: upsertPlanBodySchema,
    metadata: {
      openapi: {
        summary: "Create or update subscription plan",
        description: "Creates or updates one pricing plan and maps it to Razorpay plan ids",
        responses: {
          200: {
            description: "Plan saved",
          },
        },
      },
    },
    use: [signedInSessionMiddleware],
  },
  async (ctx) => {
    const db = resolveAuthDatabase();
    const code = normalizePlanCode(ctx.body.code);

    const [existing] = await db
      .select({ id: schema.subscriptionPlans.id })
      .from(schema.subscriptionPlans)
      .where(eq(schema.subscriptionPlans.code, code))
      .limit(1);

    const payload = {
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
      includedProperties: ctx.body.includedProperties ?? 0,
      addonPropertyOneTimeCostInPaise: ctx.body.addonPropertyOneTimeCostInPaise ?? 0,
      isActive: ctx.body.isActive ?? true,
      features: ctx.body.features ?? {},
      metadata: ctx.body.metadata ?? {},
      updatedAt: new Date(),
    };

    if (existing) {
      await db
        .update(schema.subscriptionPlans)
        .set(payload)
        .where(eq(schema.subscriptionPlans.id, existing.id));
    } else {
      const now = new Date();
      await db.insert(schema.subscriptionPlans).values({
        id: generateRandomId(),
        ...payload,
        createdAt: now,
        updatedAt: now,
      });
    }

    const [plan] = await db
      .select()
      .from(schema.subscriptionPlans)
      .where(eq(schema.subscriptionPlans.code, code))
      .limit(1);

    return ctx.json({
      plan,
    });
  }
);

const createSubscriptionEndpoint = createAuthEndpoint(
  "/organization/subscription/create",
  {
    method: "POST",
    body: createSubscriptionBodySchema,
    metadata: {
      openapi: {
        summary: "Create organization subscription",
        description: "Creates a Razorpay subscription and links it with organization_subscription",
        responses: {
          200: {
            description: "Subscription created",
          },
        },
      },
    },
    use: [signedInSessionMiddleware],
  },
  async (ctx) => {
    const session = ctx.context.session as any;
    const organizationId = await resolveOrganizationId(session, ctx.body.organizationId);

    await assertOrganizationAccess(session.user.id, organizationId);

    const [plan, currentSubscription] = await Promise.all([
      getPlanById(ctx.body.subscriptionPlanId),
      getOrganizationSubscription(organizationId),
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

    const razorpayPlanId = plan.razorpayPlanId;
    const quantity = ctx.body.quantity ?? plan.quantity ?? 1;
    const totalCount = ctx.body.totalCount ?? plan.totalCount ?? 12;
    const customerNotifyRequested =
      ctx.body.customerNotify ?? SUBSCRIPTION_NOTIFICATION_CONFIG.defaultCustomerNotify;
    const notificationMode =
      ctx.body.notificationMode ?? (ctx.body.applicationNotifyOnly ? "application" : "auto");
    const applicationNotifyOnly = notificationMode === "application";
    const customerNotify = notificationMode === "application" ? false : customerNotifyRequested;
    const trialDaysApplied = ctx.body.trialDays ?? plan.trialDays ?? 0;
    const includedProperties = plan.includedProperties ?? 0;
    const additionalProperties = ctx.body.additionalProperties ?? 0;
    const addonPropertyOneTimeCostInPaise =
      ctx.body.addonPropertyOneTimeCostInPaise ?? plan.addonPropertyOneTimeCostInPaise ?? 0;
    const addonOneTimeTotalInPaise = additionalProperties * addonPropertyOneTimeCostInPaise;

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
      baseAmountInPaise: String(plan.amountInPaise),
      includedProperties: String(includedProperties),
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
      plan_id: razorpayPlanId,
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
      // Keep auth window explicit and short-lived as recommended for hosted auth links.
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
      throw new APIError("BAD_REQUEST", {
        message,
      });
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

    let notificationSentByApp = false;

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
              // Keep create subscription successful even when fallback email delivery fails.
              return false;
            }
          })()
        : Promise.resolve(false);

    const subscription = await upsertOrganizationSubscription({
      organizationId,
      razorpaySubscription,
      plan: {
        id: plan.id,
        code: plan.code,
      },
      baseAmountInPaise: plan.amountInPaise,
      billingPeriod: plan.billingInterval,
      trialDaysApplied,
      includedProperties,
      additionalProperties,
      addonPropertyOneTimeCostInPaise,
      addonOneTimeTotalInPaise,
      trialStart,
      trialEnd,
      metadata: ctx.body.metadata ?? {},
      notes,
      razorpayCustomerId: requestedCustomerId,
    });

    notificationSentByApp = await fallbackEmailPromise;

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
    metadata: {
      openapi: {
        summary: "Get current organization subscription",
        description: "Returns latest subscription status and mapped plan for an organization",
        responses: {
          200: {
            description: "Current subscription",
          },
        },
      },
    },
    use: [signedInSessionMiddleware],
  },
  async (ctx) => {
    const session = ctx.context.session as any;
    const organizationId = await resolveOrganizationId(session, ctx.query.organizationId);

    await assertOrganizationAccess(session.user.id, organizationId);

    const subscription = await getOrganizationSubscription(organizationId);
    const plan = await getPlanById(subscription?.subscriptionPlanId ?? null);

    return ctx.json({
      subscription,
      plan,
    });
  }
);

const syncSubscriptionEndpoint = createAuthEndpoint(
  "/organization/subscription/sync",
  {
    method: "POST",
    body: syncSubscriptionBodySchema,
    metadata: {
      openapi: {
        summary: "Sync organization subscription",
        description: "Fetches latest state from Razorpay and updates organization_subscription",
        responses: {
          200: {
            description: "Subscription synced",
          },
        },
      },
    },
    use: [signedInSessionMiddleware],
  },
  async (ctx) => {
    const session = ctx.context.session as any;
    const organizationId = await resolveOrganizationId(session, ctx.body.organizationId);

    await assertOrganizationAccess(session.user.id, organizationId);

    const subscription = await getOrganizationSubscription(organizationId);

    if (!subscription?.razorpaySubscriptionId) {
      throw new APIError("BAD_REQUEST", {
        message: "No Razorpay subscription is linked with this organization.",
      });
    }

    const razorpaySubscription = await rzClient.subscriptions.fetch(
      subscription.razorpaySubscriptionId
    );

    const linkedPlan = await getPlanByRazorpayPlanId(razorpaySubscription.plan_id);

    const syncedSubscription = await upsertOrganizationSubscription({
      organizationId,
      razorpaySubscription,
      plan: linkedPlan
        ? {
            id: linkedPlan.id,
            code: linkedPlan.code,
          }
        : null,
      fallbackPlanCode: linkedPlan?.code ?? subscription.planCode,
      baseAmountInPaise: subscription.baseAmountInPaise,
      billingPeriod: subscription.billingPeriod,
      trialDaysApplied: subscription.trialDaysApplied,
      includedProperties: subscription.includedProperties,
      additionalProperties: subscription.additionalProperties,
      addonPropertyOneTimeCostInPaise: subscription.addonPropertyOneTimeCostInPaise,
      addonOneTimeTotalInPaise: subscription.addonOneTimeTotalInPaise,
      metadata: subscription.metadata ?? {},
      notes: subscription.notes ?? {},
      trialStart: subscription.trialStart,
      trialEnd: subscription.trialEnd,
      razorpayCustomerId: subscription.razorpayCustomerId,
    });

    return ctx.json({
      subscription: syncedSubscription,
    });
  }
);

const cancelSubscriptionEndpoint = createAuthEndpoint(
  "/organization/subscription/cancel",
  {
    method: "POST",
    body: cancelSubscriptionBodySchema,
    metadata: {
      openapi: {
        summary: "Cancel organization subscription",
        description: "Cancels Razorpay subscription and updates local organization_subscription",
        responses: {
          200: {
            description: "Subscription cancelled",
          },
        },
      },
    },
    use: [signedInSessionMiddleware],
  },
  async (ctx) => {
    const session = ctx.context.session as any;
    const organizationId = await resolveOrganizationId(session, ctx.body.organizationId);

    await assertOrganizationAccess(session.user.id, organizationId);

    const subscription = await getOrganizationSubscription(organizationId);

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

    const cancelledSubscription = await upsertOrganizationSubscription({
      organizationId,
      razorpaySubscription,
      plan: linkedPlan
        ? {
            id: linkedPlan.id,
            code: linkedPlan.code,
          }
        : null,
      fallbackPlanCode: linkedPlan?.code ?? subscription.planCode,
      baseAmountInPaise: subscription.baseAmountInPaise,
      billingPeriod: subscription.billingPeriod,
      trialDaysApplied: subscription.trialDaysApplied,
      includedProperties: subscription.includedProperties,
      additionalProperties: subscription.additionalProperties,
      addonPropertyOneTimeCostInPaise: subscription.addonPropertyOneTimeCostInPaise,
      addonOneTimeTotalInPaise: subscription.addonOneTimeTotalInPaise,
      metadata: subscription.metadata ?? {},
      notes: subscription.notes ?? {},
      trialStart: subscription.trialStart,
      trialEnd: subscription.trialEnd,
      razorpayCustomerId: subscription.razorpayCustomerId,
    });

    return ctx.json({
      subscription: cancelledSubscription,
    });
  }
);

const pauseSubscriptionEndpoint = createAuthEndpoint(
  "/organization/subscription/pause",
  {
    method: "POST",
    body: pauseSubscriptionBodySchema,
    metadata: {
      openapi: {
        summary: "Pause organization subscription",
        description: "Pauses Razorpay subscription and updates local organization_subscription",
        responses: {
          200: {
            description: "Subscription paused",
          },
        },
      },
    },
    use: [signedInSessionMiddleware],
  },
  async (ctx) => {
    const session = ctx.context.session as any;
    const organizationId = await resolveOrganizationId(session, ctx.body.organizationId);

    await assertOrganizationAccess(session.user.id, organizationId);

    const subscription = await getOrganizationSubscription(organizationId);

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

    const pausedSubscription = await upsertOrganizationSubscription({
      organizationId,
      razorpaySubscription,
      plan: linkedPlan
        ? {
            id: linkedPlan.id,
            code: linkedPlan.code,
          }
        : null,
      fallbackPlanCode: linkedPlan?.code ?? subscription.planCode,
      baseAmountInPaise: subscription.baseAmountInPaise,
      billingPeriod: subscription.billingPeriod,
      trialDaysApplied: subscription.trialDaysApplied,
      includedProperties: subscription.includedProperties,
      additionalProperties: subscription.additionalProperties,
      addonPropertyOneTimeCostInPaise: subscription.addonPropertyOneTimeCostInPaise,
      addonOneTimeTotalInPaise: subscription.addonOneTimeTotalInPaise,
      metadata: subscription.metadata ?? {},
      notes: subscription.notes ?? {},
      trialStart: subscription.trialStart,
      trialEnd: subscription.trialEnd,
      razorpayCustomerId: subscription.razorpayCustomerId,
    });

    return ctx.json({
      subscription: pausedSubscription,
    });
  }
);

const resumeSubscriptionEndpoint = createAuthEndpoint(
  "/organization/subscription/resume",
  {
    method: "POST",
    body: resumeSubscriptionBodySchema,
    metadata: {
      openapi: {
        summary: "Resume organization subscription",
        description: "Resumes Razorpay subscription and updates local organization_subscription",
        responses: {
          200: {
            description: "Subscription resumed",
          },
        },
      },
    },
    use: [signedInSessionMiddleware],
  },
  async (ctx) => {
    const session = ctx.context.session as any;
    const organizationId = await resolveOrganizationId(session, ctx.body.organizationId);

    await assertOrganizationAccess(session.user.id, organizationId);

    const subscription = await getOrganizationSubscription(organizationId);

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

    const resumedSubscription = await upsertOrganizationSubscription({
      organizationId,
      razorpaySubscription,
      plan: linkedPlan
        ? {
            id: linkedPlan.id,
            code: linkedPlan.code,
          }
        : null,
      fallbackPlanCode: linkedPlan?.code ?? subscription.planCode,
      baseAmountInPaise: subscription.baseAmountInPaise,
      billingPeriod: subscription.billingPeriod,
      trialDaysApplied: subscription.trialDaysApplied,
      includedProperties: subscription.includedProperties,
      additionalProperties: subscription.additionalProperties,
      addonPropertyOneTimeCostInPaise: subscription.addonPropertyOneTimeCostInPaise,
      addonOneTimeTotalInPaise: subscription.addonOneTimeTotalInPaise,
      metadata: subscription.metadata ?? {},
      notes: subscription.notes ?? {},
      trialStart: subscription.trialStart,
      trialEnd: subscription.trialEnd,
      razorpayCustomerId: subscription.razorpayCustomerId,
    });

    return ctx.json({
      subscription: resumedSubscription,
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
          200: {
            description: "Webhook processed",
          },
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
      return ctx.json({
        received: true,
        ignored: true,
      });
    }

    const razorpaySubscription = event?.payload?.subscription?.entity as any;

    if (!razorpaySubscription?.id) {
      return ctx.json({
        received: true,
        ignored: true,
      });
    }

    const db = resolveAuthDatabase();
    const notes = normalizeStringRecord(razorpaySubscription.notes);

    const [existingSubscription] = await db
      .select()
      .from(schema.organizationSubscription)
      .where(eq(schema.organizationSubscription.razorpaySubscriptionId, razorpaySubscription.id))
      .limit(1);

    const organizationId = notes.organizationId || existingSubscription?.organizationId || null;

    if (!organizationId) {
      return ctx.json({
        received: true,
        ignored: true,
      });
    }

    const [organization] = await db
      .select({
        razorpayCustomerId: schema.organization.razorpayCustomerId,
      })
      .from(schema.organization)
      .where(eq(schema.organization.id, organizationId))
      .limit(1);

    const linkedPlan = await getPlanByRazorpayPlanId(razorpaySubscription.plan_id);

    await upsertOrganizationSubscription({
      organizationId,
      razorpaySubscription,
      plan: linkedPlan
        ? {
            id: linkedPlan.id,
            code: linkedPlan.code,
          }
        : null,
      fallbackPlanCode: linkedPlan?.code ?? notes.planCode ?? existingSubscription?.planCode,
      baseAmountInPaise:
        toNullableNumber(notes.baseAmountInPaise, existingSubscription?.baseAmountInPaise ?? 0) ??
        0,
      billingPeriod:
        existingSubscription?.billingPeriod ?? linkedPlan?.billingInterval ?? "monthly",
      trialDaysApplied:
        toNullableNumber(notes.trialDaysApplied, existingSubscription?.trialDaysApplied ?? 0) ?? 0,
      includedProperties:
        toNullableNumber(notes.includedProperties, existingSubscription?.includedProperties ?? 0) ??
        0,
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

    return ctx.json({
      received: true,
    });
  }
);

export const organizationSubscriptionPlugin = {
  id: "organization-subscription",
  endpoints: {
    listOrganizationSubscriptionPlans: listPlansEndpoint,
    upsertOrganizationSubscriptionPlan: upsertPlanEndpoint,
    createOrganizationSubscription: createSubscriptionEndpoint,
    getCurrentOrganizationSubscription: currentSubscriptionEndpoint,
    syncOrganizationSubscription: syncSubscriptionEndpoint,
    cancelOrganizationSubscription: cancelSubscriptionEndpoint,
    pauseOrganizationSubscription: pauseSubscriptionEndpoint,
    resumeOrganizationSubscription: resumeSubscriptionEndpoint,
    organizationSubscriptionWebhook: webhookEndpoint,
  },
} satisfies BetterAuthPlugin;
