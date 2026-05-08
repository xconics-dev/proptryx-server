/** biome-ignore-all lint/suspicious/noTsIgnore: forced */
import { serve } from "@hono/node-server";
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
import { logger } from "@/lib/logger";
import { membersGroup } from "@/routers/members";
import { meetingGroup } from "@/routers/meeting";
import { propertyGroup } from "@/routers/property";
import { rolesPermissionGroup } from "@/routers/roles-permission";
import type { AppBindings } from "@/types/app";
import { openApiInfo } from "./config/openapi";

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
    serviceName: "company",
    includeConnectionInfo: true,
  })
);
app.get("/favicon.png", faviconHandler);
app.get("/favicon.ico", faviconHandler);

const routes = app
  .route("/meeting", meetingGroup)
  .route("/property", propertyGroup)
  .route("/member", membersGroup)
  .route("/roles-permission", rolesPermissionGroup);

app.doc("/doc", openApiInfo);
const docsHandler = createOpenApiDocsHandler({
  specUrl: "./doc",
  pageTitle: "Proptryx Company Service API",
  hideClientButton: true,
});

app.get("/", docsHandler);
app.get("/docs", docsHandler);

app.notFound(createNotFoundHandler());
app.onError(createErrorHandler({ serviceName: "company", logger }));

await initDB({ logger, serviceName: "company" });

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info("service started", {
    port: info.port,
    baseUrl: `http://localhost:${info.port}`,
    healthPath: "/health",
  });
});

export type AppType = typeof routes;

export default app;
