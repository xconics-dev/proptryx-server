/** biome-ignore-all lint/suspicious/noExplicitAny: Better Auth and Razorpay contexts are runtime-shaped */
import * as schema from "@proptryx/database";
import type { SubscriptionPlanFeatures } from "@proptryx/database";
import { generateRandomId, getRazorpayClient } from "@proptryx/utils";
import { APIError } from "better-auth";
import { createAuthMiddleware, sessionMiddleware } from "better-auth/api";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { resolveAuthDatabase } from "../../auth/utils";

export const rzClient = getRazorpayClient();

export const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "created",
  "authenticated",
  "active",
  "pending",
  "halted",
  "paused",
]);

export const SUBSCRIPTION_NOTIFICATION_CONFIG = {
  defaultCustomerNotify: true,
  authLinkExpireWindowSeconds: 24 * 60 * 60,
} as const;

export type SubscriptionNotificationContactInput = {
  organizationEmail?: string | null;
  organizationPhoneNumber?: string | null;
  sessionEmail?: string | null;
  sessionPhoneNumber?: string | null;
};

export const planFeaturesSchema = z
  .object({
    maxProperties: z.number().int().min(-1).default(-1),
    maxUsers: z.number().int().min(-1).default(-1),
  })
  .catchall(z.union([z.string(), z.number(), z.boolean()]));

export const createPlanBodySchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  description: z.string().optional(),
  amountInPaise: z.number().int().positive(),
  discountedAmountInPaise: z.number().int().positive().nullable().optional(),
  discountAvailableTill: z.coerce.date().nullable().optional(),
  currency: z.string().min(3).default("INR"),
  billingInterval: z.enum(["monthly", "yearly"]).default("monthly"),
  razorpayPlanId: z.string().min(1),
  totalCount: z.number().int().positive().optional(),
  quantity: z.number().int().positive().optional(),
  trialDays: z.number().int().min(0).optional(),
  addonPropertyOneTimeCostInPaise: z.number().int().min(0).optional(),
  isRecommended: z.boolean(),
  isActive: z.boolean().optional(),
  features: planFeaturesSchema,
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updatePlanBodySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2).optional(),
  description: z.string().nullable().optional(),
  amountInPaise: z.number().int().positive().optional(),
  discountedAmountInPaise: z.number().int().positive().nullable().optional(),
  discountAvailableTill: z.coerce.date().nullable().optional(),
  currency: z.string().min(3).optional(),
  billingInterval: z.enum(["monthly", "yearly"]).optional(),
  razorpayPlanId: z.string().min(1).optional(),
  totalCount: z.number().int().positive().nullable().optional(),
  quantity: z.number().int().positive().optional(),
  trialDays: z.number().int().min(0).optional(),
  addonPropertyOneTimeCostInPaise: z.number().int().min(0).optional(),
  isRecommended: z.boolean(),
  isActive: z.boolean().optional(),
  features: planFeaturesSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const getPlanQuerySchema = z.object({
  id: z.string().optional(),
  code: z.string().optional(),
});

export const razorpayPlanLookupQuerySchema = z.object({
  razorpayPlanId: z.string().trim().min(1),
  currentPlanId: z.string().trim().min(1).optional(),
});

export const listPlansQuerySchema = z.object({
  includeInactive: z.coerce.boolean().optional(),
});

export const deactivatePlanBodySchema = z.object({
  id: z.string().min(1),
});

export const deletePlanBodySchema = z.object({
  id: z.string().min(1),
});

export const createSubscriptionBodySchema = z.object({
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

export const cancelSubscriptionBodySchema = z.object({
  organizationId: z.string().optional(),
  cancelAtCycleEnd: z.boolean().optional(),
});

export const deleteSubscriptionBodySchema = z.object({
  organizationId: z.string().optional(),
});

export const pauseSubscriptionBodySchema = z.object({
  organizationId: z.string().optional(),
  pauseAt: z.enum(["now"]).optional(),
});

export const resumeSubscriptionBodySchema = z.object({
  organizationId: z.string().optional(),
  resumeAt: z.enum(["now"]).optional(),
});

export const syncSubscriptionBodySchema = z.object({
  organizationId: z.string().optional(),
});

export const getCurrentSubscriptionQuerySchema = z.object({
  organizationId: z.string().optional(),
});

export const paymentStatusQuerySchema = z.object({
  organizationId: z.string().optional(),
});

export const getLimitsQuerySchema = z.object({
  organizationId: z.string().optional(),
});

export const signedInSessionMiddleware = createAuthMiddleware(
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

export function createAuthorizedOrganizationMiddleware(
  resolveExplicitOrganizationId: (ctx: any) => string | undefined
) {
  return createAuthMiddleware(
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

      const organizationId = await resolveOrganizationId(
        session,
        resolveExplicitOrganizationId(ctx)
      );

      // Proptryx internal users are not organization members but have full access
      const isInternalUser = session.user.panel === "proptryx";
      if (!isInternalUser) {
        await assertOrganizationAccess(session.user.id, organizationId);
      }

      return {
        session,
        organizationId,
      };
    }
  );
}

export function normalizePlanCode(planCode: string) {
  return planCode.trim().toLowerCase();
}

export function toDateFromUnix(unixValue?: number | string | null) {
  if (unixValue === null || unixValue === undefined) {
    return null;
  }

  const numericValue = typeof unixValue === "string" ? Number(unixValue) : unixValue;

  if (!Number.isFinite(numericValue)) {
    return null;
  }

  return new Date(numericValue * 1000);
}

export function toNullableNumber(value: unknown, fallback: number | null = null) {
  if (value === null || value === undefined) {
    return fallback;
  }

  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

export function normalizeStringRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value)
      .filter((entry) => typeof entry[1] === "string")
      .map((entry) => [entry[0], String(entry[1])])
  );
}

export function getRazorpayErrorMessage(error: unknown, fallback: string) {
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

export async function createRazorpaySubscriptionWithLink(createParams: any) {
  const razorpaySubscription: any = await (rzClient.subscriptions.create as any)(createParams);

  let paymentLink = razorpaySubscription.short_url || null;

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

export function resolveSubscriptionNotifyContacts(input: SubscriptionNotificationContactInput) {
  const notifyEmail = input.organizationEmail || input.sessionEmail || null;
  const notifyPhone = normalizeContactForNotify(
    input.organizationPhoneNumber || input.sessionPhoneNumber || null
  );

  return {
    notifyEmail,
    notifyPhone,
  };
}

export async function resolveOrganizationId(session: any, explicitOrganizationId?: string) {
  const organizationId = explicitOrganizationId || session?.session?.activeOrganizationId;

  if (!organizationId) {
    throw new APIError("BAD_REQUEST", {
      message: "organizationId is required or set an active organization first.",
    });
  }

  return organizationId;
}

export async function assertOrganizationAccess(userId: string, organizationId: string) {
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

export async function getPlanById(planId: string | null | undefined) {
  if (!planId) {
    return null;
  }

  const db = resolveAuthDatabase();
  const [plan] = await db
    .select()
    .from(schema.subscriptionPlans)
    .where(
      and(eq(schema.subscriptionPlans.id, planId), eq(schema.subscriptionPlans.isDeleted, false))
    )
    .limit(1);

  return plan ?? null;
}

export async function getPlanByCode(code: string) {
  const db = resolveAuthDatabase();
  const [plan] = await db
    .select()
    .from(schema.subscriptionPlans)
    .where(
      and(
        eq(schema.subscriptionPlans.code, normalizePlanCode(code)),
        eq(schema.subscriptionPlans.isDeleted, false)
      )
    )
    .limit(1);

  return plan ?? null;
}

export async function getPlanByRazorpayPlanId(razorpayPlanId: string) {
  const db = resolveAuthDatabase();
  const [plan] = await db
    .select()
    .from(schema.subscriptionPlans)
    .where(
      and(
        eq(schema.subscriptionPlans.razorpayPlanId, razorpayPlanId),
        eq(schema.subscriptionPlans.isDeleted, false)
      )
    )
    .limit(1);

  return plan ?? null;
}

export async function getRecommendedPlan(excludePlanId?: string | null) {
  const db = resolveAuthDatabase();
  const filters = [
    eq(schema.subscriptionPlans.isDeleted, false),
    eq(schema.subscriptionPlans.isRecommended, true),
  ];

  if (excludePlanId) {
    filters.push(ne(schema.subscriptionPlans.id, excludePlanId));
  }

  const [plan] = await db
    .select()
    .from(schema.subscriptionPlans)
    .where(and(...filters))
    .limit(1);

  return plan ?? null;
}

export async function ensureOrganizationWithCustomer(organizationId: string, sessionUser: any) {
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

export function isActiveSubscriptionStatus(status: string | null | undefined) {
  if (!status) {
    return false;
  }

  return ACTIVE_SUBSCRIPTION_STATUSES.has(status.toLowerCase());
}

export function getPlanFeatures(plan: { features?: SubscriptionPlanFeatures | null } | null) {
  return (plan?.features ?? {}) as SubscriptionPlanFeatures;
}

export function getPlanIncludedProperties(
  plan: { features?: SubscriptionPlanFeatures | null } | null,
  fallback = 0
) {
  const features = getPlanFeatures(plan);
  return features.maxProperties ?? fallback;
}

export async function getOrganizationSubscriptionRecord(organizationId: string) {
  const db = resolveAuthDatabase();
  const [subscription] = await db
    .select()
    .from(schema.organizationSubscription)
    .where(
      and(
        eq(schema.organizationSubscription.organizationId, organizationId),
        eq(schema.organizationSubscription.isDeleted, false)
      )
    )
    .limit(1);

  return subscription ?? null;
}

export async function getOrganizationSubscriptionRecordByRazorpaySubscriptionId(
  razorpaySubscriptionId: string
) {
  const db = resolveAuthDatabase();
  const [subscription] = await db
    .select()
    .from(schema.organizationSubscription)
    .where(
      and(
        eq(schema.organizationSubscription.razorpaySubscriptionId, razorpaySubscriptionId),
        eq(schema.organizationSubscription.isDeleted, false)
      )
    )
    .limit(1);

  return subscription ?? null;
}

export const listSubscriptionsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
  status: z.string().optional(),
  organizationId: z.string().optional(),
  planCode: z.string().optional(),
  billingPeriod: z.enum(["monthly", "yearly"]).optional(),
  createdFrom: z.coerce.date().optional(),
  createdTo: z.coerce.date().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "status", "paidCount"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

type SaveOrganizationSubscriptionRecordParams = {
  organizationId: string;
  razorpaySubscription: any;
  plan: {
    id: string;
    code: string;
  } | null;
  existing?: any | null;
  fallbackPlanCode?: string;
  baseAmountInPaise?: number;
  billingPeriod?: string;
  trialDaysApplied?: number;
  additionalProperties?: number;
  addonPropertyOneTimeCostInPaise?: number;
  addonOneTimeTotalInPaise?: number;
  trialStart?: Date | null;
  trialEnd?: Date | null;
  metadata?: Record<string, unknown>;
  notes?: Record<string, string>;
  razorpayCustomerId?: string | null;
  createdByUserId?: string | null;
  updatedByUserId?: string | null;
};

function buildOrganizationSubscriptionRecordValues(
  params: SaveOrganizationSubscriptionRecordParams,
  existing: any | null
) {
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

  return {
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
    updatedByUser:
      params.updatedByUserId !== undefined
        ? params.updatedByUserId
        : (existing?.updatedByUser ?? null),
    updatedAt: new Date(),
  };
}

export async function createOrganizationSubscriptionRecord(
  params: SaveOrganizationSubscriptionRecordParams
) {
  const db = resolveAuthDatabase();
  const now = new Date();
  const values = buildOrganizationSubscriptionRecordValues(params, null);

  const [created] = await db
    .insert(schema.organizationSubscription)
    .values({
      id: generateRandomId(),
      organizationId: params.organizationId,
      ...values,
      createdByUser: params.createdByUserId ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning();

  return created;
}

export async function updateOrganizationSubscriptionRecord(
  existing: any,
  params: SaveOrganizationSubscriptionRecordParams
) {
  const db = resolveAuthDatabase();
  const values = buildOrganizationSubscriptionRecordValues(params, existing);

  const [updated] = await db
    .update(schema.organizationSubscription)
    .set(values)
    .where(eq(schema.organizationSubscription.id, existing.id))
    .returning();

  return updated ?? existing;
}

export async function deleteOrganizationSubscriptionRecord(
  id: string,
  deletedByUserId?: string | null
) {
  const db = resolveAuthDatabase();
  const now = new Date();
  const [deleted] = await db
    .update(schema.organizationSubscription)
    .set({
      isDeleted: true,
      deletedAt: now,
      deletedByUser: deletedByUserId ?? null,
      updatedByUser: deletedByUserId ?? null,
      updatedAt: now,
    })
    .where(eq(schema.organizationSubscription.id, id))
    .returning();

  return deleted ?? null;
}

export async function saveOrganizationSubscriptionRecord(
  params: SaveOrganizationSubscriptionRecordParams
) {
  const existing =
    params.existing ?? (await getOrganizationSubscriptionRecord(params.organizationId));

  if (existing) {
    return updateOrganizationSubscriptionRecord(existing, params);
  }

  return createOrganizationSubscriptionRecord(params);
}
