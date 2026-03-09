import { serve } from "@hono/node-server";
import { initDB, initDBMiddleware } from "@proptryx/database";
import { createHonoRequestLogger } from "@proptryx/logger";
import {
  createErrorHandler,
  createFaviconHandler,
  createHealthCheckHandler,
  createNotFoundHandler,
} from "@proptryx/utils";
import { Hono } from "hono";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";

const app = new Hono();
app.use("*", createHonoRequestLogger(logger));
app.use("*", initDBMiddleware({ logger, serviceName: "auth" }));

const faviconHandler = createFaviconHandler();
app.get("/health", createHealthCheckHandler({ serviceName: "auth" }));
app.get("/favicon.png", faviconHandler);
app.get("/favicon.ico", faviconHandler);

app.notFound(createNotFoundHandler());
app.onError(createErrorHandler({ serviceName: "auth", logger }));

await initDB({ logger, serviceName: "auth" });

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info("service started", {
    port: info.port,
    baseUrl: `http://localhost:${info.port}`,
    healthPath: "/health",
  });
});

export default app;
