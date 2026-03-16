import { serve } from "@hono/node-server";
import { getDB, initDB } from "@proptryx/database";
import { createHonoRequestLogger } from "@proptryx/logger";
import {
  applyAppSecurity,
  createErrorHandler,
  createFaviconHandler,
  createHealthCheckHandler,
  createNotFoundHandler,
} from "@proptryx/utils";
import { Hono } from "hono";
import { eq, sql } from "drizzle-orm";
import { env } from "@/config/env";
import { initializeAuthSecondaryStorage } from "@/lib/auth/utils";
import { logger } from "@/lib/logger";
import { rzClient } from "@/lib/razorpay/client";
import {
  createRazorpayWebhookHandler,
  createRazorpayWebhookTestHandler,
} from "@/lib/razorpay/webhook";
import { subscriptionPlan } from "@proptryx/database";

const app = new Hono();
applyAppSecurity(app, {
  corsOrigins: env.CORS_ALLOWED_ORIGINS,
  enableGlobalRateLimit: false,
  skipBodyLimitPaths: ["/api/auth/razorpay/webhook", "/api/auth/razorpay/webhook/test"],
});
app.use("*", createHonoRequestLogger(logger));

const faviconHandler = createFaviconHandler();
app.get("/health", createHealthCheckHandler({ serviceName: "auth" }));
app.get("/api/auth/health", createHealthCheckHandler({ serviceName: "auth" }));
app.get("/api/auth/razorpay/health", async (c) => {
  let razorpayOk = true;
  let razorpayError: string | null = null;

  try {
    await rzClient.plans.all({ count: 1 });
  } catch (error) {
    razorpayOk = false;
    razorpayError = error instanceof Error ? error.message : String(error);
    logger.warn("razorpay health check failed", { error: razorpayError });
  }

  let planOk = true;
  let planError: string | null = null;
  let activePlanCount = 0;

  try {
    const [row] = await getDB()
      .select({ count: sql<number>`count(*)` })
      .from(subscriptionPlan)
      .where(eq(subscriptionPlan.isActive, true));
    activePlanCount = Number(row?.count ?? 0);
  } catch (error) {
    planOk = false;
    planError = error instanceof Error ? error.message : String(error);
    logger.warn("subscription plan health check failed", { error: planError });
  }

  const ok = razorpayOk && planOk;
  return c.json({
    success: ok,
    status: ok ? "ok" : "degraded",
    razorpay: {
      ok: razorpayOk,
      error: razorpayError,
    },
    plans: {
      ok: planOk,
      activeCount: activePlanCount,
      error: planError,
    },
  });
});
app.get("/favicon.png", faviconHandler);
app.get("/favicon.ico", faviconHandler);
app.get("/docs", (c) => c.redirect("/api/auth/docs", 302));
app.get("/", (c) => c.redirect("/docs", 302));

await initDB({ logger, serviceName: "auth" });
await initializeAuthSecondaryStorage();
const { getAuth } = await import("@/lib/auth");
await getAuth();

app.all("/api/auth/razorpay/webhook", createRazorpayWebhookHandler(getAuth, logger));
app.post("/api/auth/razorpay/webhook/test", createRazorpayWebhookTestHandler(logger));

app.all("*", async (c) => (await getAuth()).handler(c.req.raw));
app.notFound(createNotFoundHandler());
app.onError(createErrorHandler({ serviceName: "auth", logger }));

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info("service started", {
    port: info.port,
    baseUrl: `http://localhost:${info.port}`,
    healthPath: "/health",
  });
});

export default app;
