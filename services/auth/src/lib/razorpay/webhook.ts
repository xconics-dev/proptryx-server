import { createHmac } from "crypto";
import type { Context } from "hono";
import { env } from "@/config/env";
import { getDB, subscription, subscriptionPlan } from "@proptryx/database";
import { and, eq, isNull } from "drizzle-orm";

type AuthGetter = () => Promise<{ handler: (request: Request) => Promise<Response> }>;
type Logger = {
  warn: (message: string, payload?: Record<string, unknown>) => void;
};

function getHeader(c: Context, name: string) {
  return c.req.header(name) ?? null;
}

function createBadRequestResponse(c: Context, message: string) {
  return c.json(
    {
      success: false,
      error: "Bad Request",
      message,
    },
    400
  );
}

export function createRazorpayWebhookHandler(getAuth: AuthGetter, logger: Logger) {
  return async (c: Context) => {
    let rawBody = "";
    let parsedBody: Record<string, unknown> | null = null;
    try {
      rawBody = await c.req.raw.clone().text();
    } catch {
      rawBody = "";
    }

    if (!rawBody) {
      logger.warn("razorpay webhook empty body", {
        path: c.req.path,
        requestId: getHeader(c, "request-id"),
        signaturePresent: Boolean(getHeader(c, "x-razorpay-signature")),
      });
      return createBadRequestResponse(c, "Empty webhook body");
    }

    try {
      parsedBody = JSON.parse(rawBody) as Record<string, unknown>;
    } catch (error) {
      logger.warn("razorpay webhook invalid JSON", {
        path: c.req.path,
        requestId: getHeader(c, "request-id"),
        signaturePresent: Boolean(getHeader(c, "x-razorpay-signature")),
        error: error instanceof Error ? error.message : error,
      });
      return createBadRequestResponse(c, "Invalid webhook JSON");
    }

    const logContext = {
      eventId: getHeader(c, "x-razorpay-event-id"),
      path: c.req.path,
      requestId: getHeader(c, "request-id"),
      contentType: getHeader(c, "content-type"),
      signaturePresent: Boolean(getHeader(c, "x-razorpay-signature")),
      userAgent: getHeader(c, "user-agent"),
    };

    let response: Response;
    try {
      response = await (await getAuth()).handler(c.req.raw);
    } catch (error) {
      logger.warn("razorpay webhook threw before response", {
        ...logContext,
        error: error instanceof Error ? error.message : error,
      });
      throw error;
    }

    if (response.status >= 400) {
      let errorBody: string | null = null;
      try {
        errorBody = await response.clone().text();
      } catch {
        errorBody = null;
      }

      logger.warn("razorpay webhook rejected", {
        status: response.status,
        ...logContext,
        errorBody,
      });
    }

    if (response.status < 400 && parsedBody) {
      try {
        const event = parsedBody as {
          event?: string;
          payload?: {
            subscription?: {
              entity?: {
                id?: string;
                plan_id?: string;
              };
            };
          };
        };
        const razorpaySubscriptionId = event.payload?.subscription?.entity?.id;
        const razorpayPlanId = event.payload?.subscription?.entity?.plan_id;

        if (razorpaySubscriptionId && razorpayPlanId) {
          const [planRow] = await getDB()
            .select({ id: subscriptionPlan.id })
            .from(subscriptionPlan)
            .where(eq(subscriptionPlan.rzPlanId, razorpayPlanId))
            .limit(1);

          if (planRow?.id) {
            await getDB()
              .update(subscription)
              .set({ planId: planRow.id })
              .where(
                and(
                  eq(subscription.razorpaySubscriptionId, razorpaySubscriptionId),
                  isNull(subscription.planId)
                )
              );
          }
        }
      } catch (error) {
        logger.warn("razorpay webhook plan mapping failed", {
          error: error instanceof Error ? error.message : error,
        });
      }
    }

    return response;
  };
}

export function createRazorpayWebhookTestHandler(logger: Logger) {
  return async (c: Context) => {
    let rawBody = "";
    try {
      rawBody = await c.req.raw.clone().text();
    } catch {
      rawBody = "";
    }

    if (!rawBody) {
      logger.warn("razorpay webhook test empty body", {
        path: c.req.path,
        requestId: getHeader(c, "request-id"),
      });
      return createBadRequestResponse(c, "Empty webhook body");
    }

    try {
      JSON.parse(rawBody);
    } catch (error) {
      logger.warn("razorpay webhook test invalid JSON", {
        path: c.req.path,
        requestId: getHeader(c, "request-id"),
        error: error instanceof Error ? error.message : error,
      });
      return createBadRequestResponse(c, "Invalid webhook JSON");
    }

    const signature = getHeader(c, "x-razorpay-signature");
    if (!signature) {
      return createBadRequestResponse(c, "Missing Razorpay signature");
    }

    const secret = env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
      return c.json(
        {
          success: false,
          error: "Internal Server Error",
          message: "Webhook secret not configured",
        },
        500
      );
    }

    const expectedSignature = createHmac("sha256", secret).update(rawBody).digest("hex");
    const signatureValid = signature === expectedSignature;

    return c.json({
      success: signatureValid,
      signatureValid,
    });
  };
}
