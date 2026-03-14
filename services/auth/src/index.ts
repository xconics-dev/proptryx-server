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
