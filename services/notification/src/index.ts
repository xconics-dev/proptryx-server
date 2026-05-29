import { serve } from "@hono/node-server";
import { WebSocketServer } from "ws";
import { OpenAPIHono } from "@hono/zod-openapi";
import { initDB } from "@proptryx/database";
import { createHonoRequestLogger } from "@proptryx/logger";
import {
  applyAppSecurity,
  createErrorHandler,
  createFaviconHandler,
  createHealthCheckHandler,
  createNotFoundHandler,
  createOpenApiDocsHandler,
} from "@proptryx/utils";
import { env } from "@/config/env";
import { openApiInfo } from "@/config/openapi";
import { logger } from "@/lib/logger";
import type { AppBindings } from "@/types/app";
import {
  internalNotificationGroup,
  notificationGroup,
  proptryxNotificationGroup,
} from "@/routers/notifications/handler";
import { startNotificationDeletePurgeCron } from "@/routers/notifications/utils";

const app = new OpenAPIHono<AppBindings>();

applyAppSecurity(app, {
  corsOrigins: env.CORS_ALLOWED_ORIGINS,
  enableGlobalRateLimit: false,
});

app.use("*", createHonoRequestLogger(logger));

const faviconHandler = createFaviconHandler();
app.get(
  "/health",
  createHealthCheckHandler({
    serviceName: "notification",
    includeConnectionInfo: true,
  })
);
app.get("/favicon.png", faviconHandler);
app.get("/favicon.ico", faviconHandler);

const routes = app
  .route("/", notificationGroup)
  .route("/proptryx", proptryxNotificationGroup)
  .route("/internal", internalNotificationGroup);

app.doc("/doc", openApiInfo);
const docsHandler = createOpenApiDocsHandler({
  specUrl: "./doc",
  pageTitle: "Proptryx Notification Service API",
  hideClientButton: true,
});

app.get("/", docsHandler);
app.get("/docs", docsHandler);

app.notFound(createNotFoundHandler());
app.onError(createErrorHandler({ serviceName: "notification", logger }));

await initDB({ logger, serviceName: "notification" });
startNotificationDeletePurgeCron();

const websocketServer = new WebSocketServer({ noServer: true });

serve({ fetch: app.fetch, port: env.PORT, websocket: { server: websocketServer } }, (info) => {
  logger.info("service started", {
    port: info.port,
    baseUrl: `http://localhost:${info.port}`,
    healthPath: "/health",
  });
});

export type AppType = typeof routes;

export default app;
