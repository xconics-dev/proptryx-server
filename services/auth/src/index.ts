import { serve } from "@hono/node-server";
import { initDB, initDBMiddleware } from "@proptryx/database";
import { createHonoRequestLogger } from "@proptryx/logger";
import { Hono } from "hono";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import healthRoute from "@/routes/health";

const app = new Hono();
app.use("*", createHonoRequestLogger(logger));
app.use("*", initDBMiddleware({ logger, serviceName: "auth" }));

app.route("/health", healthRoute);

app.notFound((c) =>
  c.json(
    {
      success: false,
      error: "Not Found",
      message: `${c.req.method} ${c.req.path} not found`,
    },
    404
  )
);

await initDB({ logger, serviceName: "auth" });

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info("service started", {
    port: info.port,
    baseUrl: `http://localhost:${info.port}`,
    healthPath: "/health",
  });
});

export default app;
