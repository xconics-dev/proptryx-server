import { serve } from "@hono/node-server";
import { initDB, initDBMiddleware } from "@proptryx/database";
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
import { logger } from "@/lib/logger";

const app = new Hono();
applyAppSecurity(app, { corsOrigins: env.CORS_ALLOWED_ORIGINS });
app.use("*", createHonoRequestLogger(logger));
app.use("*", initDBMiddleware({ logger, serviceName: "auth" }));

const faviconHandler = createFaviconHandler();
app.get("/health", createHealthCheckHandler({ serviceName: "auth" }));
app.get("/favicon.png", faviconHandler);
app.get("/favicon.ico", faviconHandler);
app.get("/", (c) => c.redirect("/docs", 302));

await initDB({ logger, serviceName: "auth" });
const { auth } = await import("@/lib/auth");

app.on(["GET", "POST"], "*", (c) => auth.handler(c.req.raw));
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
