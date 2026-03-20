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
} from "@proptryx/utils";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { openApiInfo } from "./config/openapi";
import { Scalar } from "@scalar/hono-api-reference";
import { OpenAPIHono } from "@hono/zod-openapi";
import { clientGroup } from "@/routers/client/handler";
import type { AppBindings } from "@/types/app";

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

app.notFound(createNotFoundHandler());
app.onError(createErrorHandler({ serviceName: "kernel", logger }));

/* openapi */
app.doc("/doc", openApiInfo);
app.get(
  "/",
  Scalar({
    url: "./doc",
    theme: "purple",
    pageTitle: `Proptryx Kernel Service API`,
    hideClientButton: true,
  })
);

await initDB({ logger, serviceName: "kernel" });

// @ts-ignore
const routes = app.route("/client", clientGroup);

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
