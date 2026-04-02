/** biome-ignore-all lint/suspicious/noTsIgnore: forced */
import { serve } from "@hono/node-server";
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
import { openApiInfo } from "./config/openapi";
import { OpenAPIHono } from "@hono/zod-openapi";
import { companyGroup } from "@/routers/company";
import type { AppBindings } from "@/types/app";
import { zoneRegionGroup } from "@/routers/zone-region/handler";
import { siteDataGroup } from "@/routers/site-data";

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
    serviceName: "kernel",
    includeConnectionInfo: true,
  })
);
app.get("/favicon.png", faviconHandler);
app.get("/favicon.ico", faviconHandler);

const routes = app
  .route("/company", companyGroup)
  .route("/site-data", siteDataGroup)
  .route("/", zoneRegionGroup);

/* openapi */
app.doc("/doc", openApiInfo);
const docsHandler = createOpenApiDocsHandler({
  specUrl: "./doc",
  pageTitle: "Proptryx Kernel Service API",
  hideClientButton: true,
});

app.get("/", docsHandler);
app.get("/docs", docsHandler);

app.notFound(createNotFoundHandler());
app.onError(createErrorHandler({ serviceName: "kernel", logger }));

await initDB({ logger, serviceName: "kernel" });

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info("service started", {
    port: info.port,
    baseUrl: `http://localhost:${info.port}`,
    healthPath: "/health",
  });
});

/* for hono RPC */
export type AppType = typeof routes;

export default app;
