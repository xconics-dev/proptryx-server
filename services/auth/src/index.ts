import { serve } from "@hono/node-server";
import { initDB } from "@proptryx/database";
import { createHonoRequestLogger } from "@proptryx/logger";
import {
  applyAppSecurity,
  createErrorHandler,
  createFaviconHandler,
  createHealthCheckHandler,
  createNotFoundHandler,
} from "@proptryx/utils";
import { Hono } from "hono";
import { env } from "@/config/env";
import { initializeAuthSecondaryStorage } from "@/lib/auth/utils";
import { logger } from "@/lib/logger";

const app = new Hono();
applyAppSecurity(app, {
  corsOrigins: env.CORS_ALLOWED_ORIGINS,
  enableGlobalRateLimit: false,
  skipBodyLimitPaths: ["/api/auth/razorpay/webhook"],
});
app.use("*", createHonoRequestLogger(logger));

const faviconHandler = createFaviconHandler();
app.get("/health", createHealthCheckHandler({ serviceName: "auth" }));
app.get("/api/auth/health", createHealthCheckHandler({ serviceName: "auth" }));
app.get("/favicon.png", faviconHandler);
app.get("/favicon.ico", faviconHandler);
app.get("/docs", (c) => c.redirect("/api/auth/docs", 302));
app.get("/", (c) => c.redirect("/docs", 302));

await initDB({ logger, serviceName: "auth" });
await initializeAuthSecondaryStorage();
const { getAuth } = await import("@/lib/auth");
await getAuth();

// Razorpay webhooks can sometimes fail due to various reasons (e.g. network issues, temporary unavailability of the auth service, etc.). To prevent missing critical webhook events, we log any failed webhook attempts with as much context as possible for later analysis and reprocessing if needed.
app.all("/api/auth/razorpay/webhook", async (c) => {
  const logContext = {
    eventId: c.req.header("x-razorpay-event-id") ?? null,
    path: c.req.path,
    requestId: c.req.header("request-id") ?? null,
    contentType: c.req.header("content-type") ?? null,
    signaturePresent: Boolean(c.req.header("x-razorpay-signature")),
    userAgent: c.req.header("user-agent") ?? null,
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

  return response;
});

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
