import { serve } from "@hono/node-server";
import { initDB, initDBMiddleware } from "@proptryx/database";
import { createHonoRequestLogger } from "@proptryx/logger";
import {
  createErrorHandler,
  createHealthCheckHandler,
  createNotFoundHandler,
} from "@proptryx/utils";
import { Hono } from "hono";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";

const app = new Hono();
app.use("*", createHonoRequestLogger(logger));
app.use("*", initDBMiddleware({ logger, serviceName: "property" }));

app.get("/health", createHealthCheckHandler({ serviceName: "property" }));

app.notFound(createNotFoundHandler());
app.onError(createErrorHandler({ serviceName: "property", logger }));

await initDB({ logger, serviceName: "property" });

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info("service started", {
    port: info.port,
    baseUrl: `http://localhost:${info.port}`,
    healthPath: "/health",
  });
});

export default app;
