import { serve } from "@hono/node-server";
import { OpenAPIHono } from "@hono/zod-openapi";
import { initDB } from "@proptryx/database";
import { createHonoRequestLogger } from "@proptryx/logger";
import {
  applyAppSecurity,
  createErrorHandler,
  createNotFoundHandler,
  createOpenApiDocsHandler,
} from "@proptryx/utils";
import { openApiInfo } from "@/config/openapi";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { logGatewayProxyRoutes, registerGatewayRoutes } from "@/routes";

const app = new OpenAPIHono();
applyAppSecurity(app, { corsOrigins: env.CORS_ALLOWED_ORIGINS });
app.use("*", createHonoRequestLogger(logger));
registerGatewayRoutes(app);

app.notFound(createNotFoundHandler());
app.onError(createErrorHandler({ serviceName: "gateway", logger }));

/* openapi */
app.doc("/doc", openApiInfo);
app.get(
  "/",
  createOpenApiDocsHandler({
    specUrl: "./doc",
    theme: "purple",
    pageTitle: "Proptryx Gateway Service API",
    hideClientButton: true,
  })
);

await initDB({ logger, serviceName: "gateway" });

serve({ fetch: app.fetch, port: env.PORT }, () => {
  logger.info("service started", {
    port: env.PORT,
    baseUrl: `http://localhost:${env.PORT}`,
    healthPath: "/health",
  });
  logGatewayProxyRoutes();
});

export default app;
