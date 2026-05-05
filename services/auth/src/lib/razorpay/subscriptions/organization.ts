/** biome-ignore-all lint/suspicious/noExplicitAny: Better Auth and Razorpay contexts are runtime-shaped */
import * as crypto from "node:crypto";
import * as schema from "@proptryx/database";
import { getOrganizationSubscriptionLimits } from "@proptryx/database";
import { emailSubject, renderCompleteSubscriptionEmail, sendEmail } from "@proptryx/notification";
import { APIError, type BetterAuthPlugin } from "better-auth";
import { createAuthEndpoint } from "better-auth/api";
import { eq, and, or, gte, lte, ilike, count, asc, desc } from "drizzle-orm";
import {
  cancelSubscriptionBodySchema,
  deleteSubscriptionBodySchema,
  createAuthorizedOrganizationMiddleware,
  createRazorpaySubscriptionWithLink,
  createSubscriptionBodySchema,
  deleteOrganizationSubscriptionRecord,
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
  listSubscriptionsQuerySchema,
  normalizeStringRecord,
  pauseSubscriptionBodySchema,
  paymentStatusQuerySchema,
  resolveSubscriptionNotifyContacts,
  resumeSubscriptionBodySchema,
  rzClient,
  saveOrganizationSubscriptionRecord,
  signedInSessionMiddleware,
  SUBSCRIPTION_NOTIFICATION_CONFIG,
  syncSubscriptionBodySchema,
  toDateFromUnix,
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

function toNullableIsoDate(value: unknown) {
  const parsedDate =
    typeof value === "number" || typeof value === "string" ? toDateFromUnix(value) : null;
  return parsedDate?.toISOString() ?? null;
}

function mapRazorpayPayment(payment: any) {
  return {
    id: String(payment?.id ?? ""),
    subscriptionId:
      payment?.subscription_id && typeof payment.subscription_id === "string"
        ? payment.subscription_id
        : null,
    amount: toNullableNumber(payment?.amount, 0) ?? 0,
    currency: String(payment?.currency ?? "INR").toUpperCase(),
    status: payment?.refunded ? "refunded" : payment?.status ? String(payment.status) : null,
    method: payment?.method ? String(payment.method) : null,
    email: payment?.email ? String(payment.email) : null,
    contact: payment?.contact ? String(payment.contact) : null,
    description: payment?.description ? String(payment.description) : null,
    invoiceId: payment?.invoice_id ? String(payment.invoice_id) : null,
    orderId: payment?.order_id ? String(payment.order_id) : null,
    fee: toNullableNumber(payment?.fee, null),
    tax: toNullableNumber(payment?.tax, null),
    refunded: Boolean(payment?.refunded),
    captured: Boolean(payment?.captured),
    createdAt: toNullableIsoDate(payment?.created_at),
  };
}

function getPaymentLinkedSubscriptionId(
  payment: any,
  invoiceSubscriptionMap: Map<string, string | null>
) {
  if (typeof payment?.subscription_id === "string" && payment.subscription_id) {
    return payment.subscription_id;
  }

  const notes = normalizeStringRecord(payment?.notes);

  if (notes.razorpaySubscriptionId) {
    return notes.razorpaySubscriptionId;
  }

  if (notes.razorpay_subscription_id) {
    return notes.razorpay_subscription_id;
  }

  if (notes.subscriptionId) {
    return notes.subscriptionId;
  }

  if (notes.subscription_id) {
    return notes.subscription_id;
  }

  if (typeof payment?.invoice_id === "string" && payment.invoice_id) {
    return invoiceSubscriptionMap.get(payment.invoice_id) ?? null;
  }

  return null;
}

function getDateValue(value: unknown) {
  if (value instanceof Date) {
    return value;
  }

  if (typeof value === "string" || typeof value === "number") {
    const parsedDate = new Date(value);
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
  }

  return null;
}

function isTrialAuthorizationPaymentForSubscription(payment: any, subscription: any) {
  if ((subscription?.trialDaysApplied ?? 0) <= 0) {
    return false;
  }

  if (
    typeof payment?.customer_id === "string" &&
    payment.customer_id &&
    payment.customer_id !== subscription.razorpayCustomerId
  ) {
    return false;
  }

  const amount = toNullableNumber(payment?.amount, null);
  const isRefunded = Boolean(payment?.refunded || payment?.status === "refunded");

  if (amount === null || amount <= 0 || amount > 500 || !isRefunded) {
    return false;
  }

  const paymentDate = toDateFromUnix(payment?.created_at);
  const createdAt = getDateValue(subscription?.createdAt);
  const trialEnd = getDateValue(subscription?.trialEnd);
  const currentStart = getDateValue(subscription?.currentStart);

  if (!(paymentDate && createdAt)) {
    return false;
  }

  const windowStart = new Date(createdAt.getTime() - 30 * 60 * 1000);
  const windowBaseEnd =
    trialEnd ?? currentStart ?? new Date(createdAt.getTime() + 2 * 24 * 60 * 60 * 1000);
  const windowEnd = new Date(windowBaseEnd.getTime() + 24 * 60 * 60 * 1000);

  return paymentDate >= windowStart && paymentDate <= windowEnd;
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

    // Block only if the subscription has already been authorized/paid.
    // "created" status means payment was never completed — allow replacing it.
    const PAID_STATUSES = new Set(["authenticated", "active", "pending", "halted", "paused"]);
    if (currentSubscription && PAID_STATUSES.has(currentSubscription.status?.toLowerCase() ?? "")) {
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
      createdByUserId: session.user.id,
      updatedByUserId: session.user.id,
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
    const raw = await getOrganizationSubscriptionRecord(organizationId);

    // Treat terminal statuses as if no subscription exists so the client
    // can proceed to /upgrade and create a fresh one.
    const TERMINAL_STATUSES = new Set(["cancelled", "expired", "completed"]);
    const subscription =
      raw && TERMINAL_STATUSES.has(raw.status?.toLowerCase?.() ?? "") ? null : raw;

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

const billingOverviewEndpoint = createAuthEndpoint(
  "/organization/subscription/billing-overview",
  {
    method: "GET",
    query: getCurrentSubscriptionQuerySchema,
    use: [createAuthorizedOrganizationMiddleware((ctx) => ctx.query?.organizationId)],
    metadata: {
      openapi: {
        summary: "Get organization subscription billing overview",
        description:
          "Returns linked Razorpay customer details, live Razorpay subscription details, and recent payment history when available.",
        responses: {
          200: { description: "Subscription billing overview" },
        },
      },
    },
  },
  async (ctx) => {
    const organizationId = ctx.context.organizationId as string;
    const db = resolveAuthDatabase();

    const [subscription, organization] = await Promise.all([
      getOrganizationSubscriptionRecord(organizationId),
      db
        .select({
          razorpayCustomerId: schema.organization.razorpayCustomerId,
        })
        .from(schema.organization)
        .where(eq(schema.organization.id, organizationId))
        .limit(1)
        .then((rows) => rows[0] ?? null),
    ]);

    const razorpayCustomerId =
      subscription?.razorpayCustomerId || organization?.razorpayCustomerId || null;

    let customer: {
      id: string;
      name: string | null;
      email: string | null;
      contact: string | null;
      gstin: string | null;
      notes: Record<string, string>;
      createdAt: string | null;
    } | null = null;
    let liveSubscription: {
      id: string;
      status: string | null;
      shortUrl: string | null;
      remainingCount: number | null;
      paidCount: number | null;
      totalCount: number | null;
      chargeAt: string | null;
      startAt: string | null;
      endAt: string | null;
      currentStart: string | null;
      currentEnd: string | null;
      authAttempts: number | null;
      hasScheduledChanges: boolean;
    } | null = null;
    let payments: ReturnType<typeof mapRazorpayPayment>[] = [];
    let paymentHistoryAvailable = false;
    let paymentHistoryMessage: string | null = null;

    if (razorpayCustomerId) {
      try {
        const rzCustomer: any = await (rzClient.customers.fetch as any)(razorpayCustomerId);
        customer = {
          id: String(rzCustomer?.id ?? razorpayCustomerId),
          name: rzCustomer?.name ? String(rzCustomer.name) : null,
          email: rzCustomer?.email ? String(rzCustomer.email) : null,
          contact: rzCustomer?.contact ? String(rzCustomer.contact) : null,
          gstin: rzCustomer?.gstin ? String(rzCustomer.gstin) : null,
          notes: normalizeStringRecord(rzCustomer?.notes),
          createdAt: toNullableIsoDate(rzCustomer?.created_at),
        };
      } catch (error) {
        logger.warn("failed to fetch razorpay customer for subscription billing overview", {
          organizationId,
          razorpayCustomerId,
          message: getRazorpayErrorMessage(error, "Unable to load Razorpay customer."),
        });
      }
    }

    if (subscription?.razorpaySubscriptionId) {
      try {
        const rzSubscription: any = await (rzClient.subscriptions.fetch as any)(
          subscription.razorpaySubscriptionId
        );
        liveSubscription = {
          id: String(rzSubscription?.id ?? subscription.razorpaySubscriptionId),
          status: rzSubscription?.status ? String(rzSubscription.status) : null,
          shortUrl: rzSubscription?.short_url ? String(rzSubscription.short_url) : null,
          remainingCount: toNullableNumber(rzSubscription?.remaining_count, null),
          paidCount: toNullableNumber(rzSubscription?.paid_count, null),
          totalCount: toNullableNumber(rzSubscription?.total_count, null),
          chargeAt: toNullableIsoDate(rzSubscription?.charge_at),
          startAt: toNullableIsoDate(rzSubscription?.start_at),
          endAt: toNullableIsoDate(rzSubscription?.end_at),
          currentStart: toNullableIsoDate(rzSubscription?.current_start),
          currentEnd: toNullableIsoDate(rzSubscription?.current_end),
          authAttempts: toNullableNumber(rzSubscription?.auth_attempts, null),
          hasScheduledChanges: Boolean(rzSubscription?.has_scheduled_changes),
        };
      } catch (error) {
        logger.warn("failed to fetch razorpay subscription for billing overview", {
          organizationId,
          razorpaySubscriptionId: subscription.razorpaySubscriptionId,
          message: getRazorpayErrorMessage(error, "Unable to load Razorpay subscription."),
        });
      }

      try {
        const subscriptionPaymentsResult: any = await (rzClient.payments.all as any)({
          subscription_id: subscription.razorpaySubscriptionId,
          count: 20,
        });
        const paymentSources: any[] = Array.isArray(subscriptionPaymentsResult?.items)
          ? subscriptionPaymentsResult.items
          : [];
        const invoiceSubscriptionMap = new Map<string, string | null>();
        const paymentInvoiceMap = new Map<string, string>();

        try {
          const subscriptionInvoicesResult: any = await (rzClient.invoices.all as any)({
            subscription_id: subscription.razorpaySubscriptionId,
            count: 100,
          });
          const subscriptionInvoices: any[] = Array.isArray(subscriptionInvoicesResult?.items)
            ? subscriptionInvoicesResult.items
            : [];

          await Promise.all(
            subscriptionInvoices.map(async (invoice) => {
              const invoiceId = typeof invoice?.id === "string" ? invoice.id : null;
              const paymentId = typeof invoice?.payment_id === "string" ? invoice.payment_id : null;

              if (invoiceId) {
                invoiceSubscriptionMap.set(invoiceId, subscription.razorpaySubscriptionId);
              }

              if (!(invoiceId && paymentId)) {
                return;
              }

              paymentInvoiceMap.set(paymentId, invoiceId);

              try {
                const invoicePayment: any = await (rzClient.payments.fetch as any)(paymentId);
                paymentSources.push({
                  ...invoicePayment,
                  invoice_id: invoicePayment?.invoice_id || invoiceId,
                  subscription_id:
                    invoicePayment?.subscription_id || subscription.razorpaySubscriptionId,
                });
              } catch (error) {
                logger.warn("failed to fetch razorpay invoice payment for billing overview", {
                  organizationId,
                  invoiceId,
                  paymentId,
                  message: getRazorpayErrorMessage(
                    error,
                    "Unable to load Razorpay invoice payment."
                  ),
                });
              }
            })
          );
        } catch (error) {
          logger.warn("failed to fetch razorpay subscription invoices for billing overview", {
            organizationId,
            razorpaySubscriptionId: subscription.razorpaySubscriptionId,
            message: getRazorpayErrorMessage(
              error,
              "Unable to load Razorpay subscription invoices."
            ),
          });
        }

        if (razorpayCustomerId) {
          try {
            const customerPaymentsResult: any = await (rzClient.payments.all as any)({
              customer_id: razorpayCustomerId,
              count: 100,
            });

            if (Array.isArray(customerPaymentsResult?.items)) {
              paymentSources.push(...customerPaymentsResult.items);
            }
          } catch (error) {
            logger.warn("failed to fetch razorpay customer payments for billing overview", {
              organizationId,
              razorpayCustomerId,
              message: getRazorpayErrorMessage(error, "Unable to load Razorpay customer payments."),
            });
          }
        }

        const rawPayments: any[] = Array.from(
          new Map<string, any>(
            paymentSources
              .filter((payment: any) => typeof payment?.id === "string" && payment.id)
              .map((payment: any) => [
                payment.id,
                {
                  ...payment,
                  invoice_id: payment?.invoice_id || paymentInvoiceMap.get(payment.id) || null,
                },
              ])
          ).values()
        );
        const invoiceIds = Array.from(
          new Set<string>(
            rawPayments
              .map((payment: any) =>
                typeof payment?.invoice_id === "string" && payment.invoice_id
                  ? payment.invoice_id
                  : null
              )
              .filter((invoiceId): invoiceId is string => Boolean(invoiceId))
          )
        );
        await Promise.all(
          invoiceIds.map(async (invoiceId) => {
            if (invoiceSubscriptionMap.has(invoiceId)) {
              return;
            }

            try {
              const invoice: any = await (rzClient.invoices.fetch as any)(invoiceId);
              invoiceSubscriptionMap.set(
                invoiceId,
                typeof invoice?.subscription_id === "string" ? invoice.subscription_id : null
              );
            } catch {
              invoiceSubscriptionMap.set(invoiceId, null);
            }
          })
        );

        payments = rawPayments
          .filter((payment: any) => {
            const linkedSubscriptionId = getPaymentLinkedSubscriptionId(
              payment,
              invoiceSubscriptionMap
            );

            return (
              linkedSubscriptionId === subscription.razorpaySubscriptionId ||
              isTrialAuthorizationPaymentForSubscription(payment, subscription)
            );
          })
          .map((payment: any) => {
            const linkedSubscriptionId = getPaymentLinkedSubscriptionId(
              payment,
              invoiceSubscriptionMap
            );
            const subscriptionId =
              linkedSubscriptionId === subscription.razorpaySubscriptionId ||
              isTrialAuthorizationPaymentForSubscription(payment, subscription)
                ? subscription.razorpaySubscriptionId
                : linkedSubscriptionId;

            return mapRazorpayPayment({
              ...payment,
              subscription_id: subscriptionId,
            });
          })
          .filter((payment: ReturnType<typeof mapRazorpayPayment>) => payment.id);
        paymentHistoryAvailable = true;
      } catch (error) {
        paymentHistoryAvailable = false;
        paymentHistoryMessage = getRazorpayErrorMessage(
          error,
          "Payment history is currently unavailable from Razorpay."
        );
        logger.warn("failed to fetch razorpay payment history for billing overview", {
          organizationId,
          razorpaySubscriptionId: subscription.razorpaySubscriptionId,
          message: paymentHistoryMessage,
        });
      }
    } else {
      paymentHistoryMessage = "No Razorpay subscription is linked with this organization yet.";
    }

    return ctx.json({
      customer,
      liveSubscription,
      payments,
      paymentHistoryAvailable,
      paymentHistoryMessage,
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
      updatedByUserId: (ctx.context.session as any)?.user?.id ?? null,
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

    // "created" subscriptions have no billing cycle — cancel immediately
    const cancelAtCycleEnd =
      subscription.status === "created" ? false : (ctx.body.cancelAtCycleEnd ?? true);
    let razorpaySubscription: any;

    try {
      razorpaySubscription = await rzClient.subscriptions.cancel(
        subscription.razorpaySubscriptionId,
        cancelAtCycleEnd
      );
    } catch (error) {
      throw new APIError("BAD_REQUEST", {
        message: getRazorpayErrorMessage(error, "Failed to cancel Razorpay subscription."),
      });
    }

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
      updatedByUserId: (ctx.context.session as any)?.user?.id ?? null,
    });

    return ctx.json({ subscription: cancelledSubscription });
  }
);

const deleteSubscriptionEndpoint = createAuthEndpoint(
  "/organization/subscription/delete",
  {
    method: "POST",
    body: deleteSubscriptionBodySchema,
    use: [createAuthorizedOrganizationMiddleware((ctx) => ctx.body?.organizationId)],
    metadata: {
      openapi: {
        summary: "Delete cancelled organization subscription record",
        description:
          "Soft deletes a cancelled organization subscription record from organization_subscription",
        responses: {
          200: { description: "Subscription record deleted" },
        },
      },
    },
  },
  async (ctx) => {
    const organizationId = ctx.context.organizationId as string;
    const deletedByUserId = (ctx.context.session as any)?.user?.id ?? null;
    const subscription = await getOrganizationSubscriptionRecord(organizationId);

    if (!subscription) {
      throw new APIError("BAD_REQUEST", {
        message: "No subscription record was found for this organization.",
      });
    }

    if (subscription.status !== "cancelled") {
      throw new APIError("BAD_REQUEST", {
        message: "Only cancelled subscription records can be deleted.",
      });
    }

    const deletedSubscription = await deleteOrganizationSubscriptionRecord(
      subscription.id,
      deletedByUserId
    );

    if (!deletedSubscription) {
      throw new APIError("BAD_REQUEST", {
        message: "Failed to delete the subscription record.",
      });
    }

    return ctx.json({ subscription: deletedSubscription });
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

    const normalizedStatus = subscription.status.toLowerCase();
    const shouldOmitPauseAt = ["created", "authenticated"].includes(normalizedStatus);
    let razorpaySubscription: any;

    try {
      razorpaySubscription = shouldOmitPauseAt
        ? await rzClient.subscriptions.pause(subscription.razorpaySubscriptionId)
        : await rzClient.subscriptions.pause(subscription.razorpaySubscriptionId, {
            pause_at: "now",
          });
    } catch (error) {
      const message = getRazorpayErrorMessage(error, "Failed to pause Razorpay subscription.");

      if (
        !shouldOmitPauseAt &&
        message.includes("pause_at is/are not required and should not be sent")
      ) {
        try {
          razorpaySubscription = await rzClient.subscriptions.pause(
            subscription.razorpaySubscriptionId
          );
        } catch (retryError) {
          throw new APIError("BAD_REQUEST", {
            message: getRazorpayErrorMessage(retryError, "Failed to pause Razorpay subscription."),
          });
        }
      } else {
        throw new APIError("BAD_REQUEST", {
          message,
        });
      }
    }

    if (!razorpaySubscription) {
      throw new APIError("BAD_REQUEST", {
        message: "Failed to pause Razorpay subscription.",
      });
    }
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
      updatedByUserId: (ctx.context.session as any)?.user?.id ?? null,
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

    let razorpaySubscription: any;

    try {
      razorpaySubscription = await rzClient.subscriptions.resume(
        subscription.razorpaySubscriptionId,
        { resume_at: "now" }
      );
    } catch (error) {
      const message = getRazorpayErrorMessage(error, "Failed to resume Razorpay subscription.");

      if (message.includes("resume_at is/are not required and should not be sent")) {
        try {
          razorpaySubscription = await rzClient.subscriptions.resume(
            subscription.razorpaySubscriptionId
          );
        } catch (retryError) {
          throw new APIError("BAD_REQUEST", {
            message: getRazorpayErrorMessage(retryError, "Failed to resume Razorpay subscription."),
          });
        }
      } else {
        throw new APIError("BAD_REQUEST", {
          message,
        });
      }
    }

    if (!razorpaySubscription) {
      throw new APIError("BAD_REQUEST", {
        message: "Failed to resume Razorpay subscription.",
      });
    }
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
      updatedByUserId: (ctx.context.session as any)?.user?.id ?? null,
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
        isPaymentAuthorized: false,
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
    // true only when the customer has completed the Razorpay payment/mandate flow.
    // "created" means the subscription exists but the customer hasn't paid yet.
    const isPaymentAuthorized = status === "authenticated" || status === "active";
    // || status === "pending";

    return ctx.json({
      status,
      isPaid,
      isActive,
      isPaymentAuthorized,
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

const listSubscriptionsEndpoint = createAuthEndpoint(
  "/organization/subscription/list",
  {
    method: "GET",
    query: listSubscriptionsQuerySchema,
    use: [signedInSessionMiddleware],
    metadata: {
      openapi: {
        operationId: "listOrganizationSubscriptions",
        summary: "List all organization subscriptions",
        description:
          "Paginated, filtered list of all organization subscriptions with joined plan and organization details. Requires authentication.",
        tags: ["Organization-subscription"],
        responses: {
          200: { description: "Paginated subscription list" },
          401: { description: "Unauthenticated" },
        },
      },
    },
  },
  async (ctx) => {
    const db = resolveAuthDatabase();
    const {
      page,
      limit,
      search,
      status,
      organizationId,
      planCode,
      billingPeriod,
      createdFrom,
      createdTo,
      sortBy,
      sortOrder: sortDir,
    } = ctx.query;

    const offset = (page - 1) * limit;

    const conditions = [
      eq(schema.organizationSubscription.isDeleted, false),
      status ? eq(schema.organizationSubscription.status, status) : undefined,
      organizationId
        ? eq(schema.organizationSubscription.organizationId, organizationId)
        : undefined,
      planCode ? eq(schema.organizationSubscription.planCode, planCode) : undefined,
      billingPeriod ? eq(schema.organizationSubscription.billingPeriod, billingPeriod) : undefined,
      createdFrom ? gte(schema.organizationSubscription.createdAt, createdFrom) : undefined,
      createdTo ? lte(schema.organizationSubscription.createdAt, createdTo) : undefined,
      search
        ? or(
            ilike(schema.organization.name, `%${search}%`),
            ilike(schema.organizationSubscription.planCode, `%${search}%`),
            ilike(schema.organizationSubscription.razorpaySubscriptionId, `%${search}%`)
          )
        : undefined,
    ].filter(Boolean) as ReturnType<typeof eq>[];

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const sortColumn =
      {
        createdAt: schema.organizationSubscription.createdAt,
        updatedAt: schema.organizationSubscription.updatedAt,
        status: schema.organizationSubscription.status,
        paidCount: schema.organizationSubscription.paidCount,
      }[sortBy] ?? schema.organizationSubscription.createdAt;

    const orderFn = sortDir === "asc" ? asc : desc;

    const [rows, [countRow]] = await Promise.all([
      db
        .select({
          id: schema.organizationSubscription.id,
          organizationId: schema.organizationSubscription.organizationId,
          organizationName: schema.organization.name,
          organizationSlug: schema.organization.slug,
          organizationEmail: schema.organization.email,
          subscriptionPlanId: schema.organizationSubscription.subscriptionPlanId,
          planCode: schema.organizationSubscription.planCode,
          planName: schema.subscriptionPlans.name,
          planBillingInterval: schema.subscriptionPlans.billingInterval,
          planAmountInPaise: schema.subscriptionPlans.amountInPaise,
          planCurrency: schema.subscriptionPlans.currency,
          razorpaySubscriptionId: schema.organizationSubscription.razorpaySubscriptionId,
          razorpayCustomerId: schema.organizationSubscription.razorpayCustomerId,
          status: schema.organizationSubscription.status,
          quantity: schema.organizationSubscription.quantity,
          totalCount: schema.organizationSubscription.totalCount,
          paidCount: schema.organizationSubscription.paidCount,
          remainingCount: schema.organizationSubscription.remainingCount,
          baseAmountInPaise: schema.organizationSubscription.baseAmountInPaise,
          billingPeriod: schema.organizationSubscription.billingPeriod,
          trialDaysApplied: schema.organizationSubscription.trialDaysApplied,
          additionalProperties: schema.organizationSubscription.additionalProperties,
          addonOneTimeTotalInPaise: schema.organizationSubscription.addonOneTimeTotalInPaise,
          currentStart: schema.organizationSubscription.currentStart,
          currentEnd: schema.organizationSubscription.currentEnd,
          trialStart: schema.organizationSubscription.trialStart,
          trialEnd: schema.organizationSubscription.trialEnd,
          endedAt: schema.organizationSubscription.endedAt,
          cancelledAt: schema.organizationSubscription.cancelledAt,
          pausedAt: schema.organizationSubscription.pausedAt,
          shortUrl: schema.organizationSubscription.shortUrl,
          cancelAtCycleEnd: schema.organizationSubscription.cancelAtCycleEnd,
          isDeleted: schema.organizationSubscription.isDeleted,
          deletedAt: schema.organizationSubscription.deletedAt,
          deletedByUser: schema.organizationSubscription.deletedByUser,
          createdByUser: schema.organizationSubscription.createdByUser,
          updatedByUser: schema.organizationSubscription.updatedByUser,
          createdAt: schema.organizationSubscription.createdAt,
          updatedAt: schema.organizationSubscription.updatedAt,
        })
        .from(schema.organizationSubscription)
        .leftJoin(
          schema.organization,
          eq(schema.organization.id, schema.organizationSubscription.organizationId)
        )
        .leftJoin(
          schema.subscriptionPlans,
          eq(schema.subscriptionPlans.id, schema.organizationSubscription.subscriptionPlanId)
        )
        .where(where)
        .orderBy(orderFn(sortColumn))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(schema.organizationSubscription)
        .leftJoin(
          schema.organization,
          eq(schema.organization.id, schema.organizationSubscription.organizationId)
        )
        .where(where),
    ]);

    const totalItems = Number(countRow?.count ?? 0);
    const totalPages = Math.max(1, Math.ceil(totalItems / limit));

    return ctx.json({
      items: rows,
      page,
      limit,
      offset,
      totalItems,
      totalPages,
    });
  }
);

export const organizationSubscriptionPlugin = {
  id: "organization-subscription",
  endpoints: {
    createOrganizationSubscription: createSubscriptionEndpoint,
    getCurrentOrganizationSubscription: currentSubscriptionEndpoint,
    getOrganizationSubscriptionLimits: limitsEndpoint,
    getOrganizationSubscriptionPaymentStatus: paymentStatusEndpoint,
    getOrganizationSubscriptionBillingOverview: billingOverviewEndpoint,
    listOrganizationSubscriptions: listSubscriptionsEndpoint,
    syncOrganizationSubscription: syncSubscriptionEndpoint,
    cancelOrganizationSubscription: cancelSubscriptionEndpoint,
    deleteOrganizationSubscription: deleteSubscriptionEndpoint,
    pauseOrganizationSubscription: pauseSubscriptionEndpoint,
    resumeOrganizationSubscription: resumeSubscriptionEndpoint,
    organizationSubscriptionWebhook: webhookEndpoint,
  },
} satisfies BetterAuthPlugin;
