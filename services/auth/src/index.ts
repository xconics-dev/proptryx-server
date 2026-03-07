import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import healthRoute from "@/routes/health";
import { createHonoRequestLogger } from "@proptryx/logger";
import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();
app.use("*", createHonoRequestLogger(logger));

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

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info("service started", {
    port: info.port,
    baseUrl: `http://localhost:${info.port}`,
    healthPath: "/health",
  });
});

export default app;
