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
import { Hono, type Context } from "hono";
import { proxy } from "hono/proxy";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { createUpstreamUrl, proxyRoutes, type ProxyRoute } from "@/proxy";

const app = new Hono();
applyAppSecurity(app, { corsOrigins: env.CORS_ALLOWED_ORIGINS });
app.use("*", createHonoRequestLogger(logger));

const faviconHandler = createFaviconHandler();
app.get("/health", createHealthCheckHandler({ serviceName: "gateway" }));
app.get("/favicon.png", faviconHandler);
app.get("/favicon.ico", faviconHandler);
app.get("/api/auth", (c) => c.redirect("/api/auth/docs", 302));
app.get("/api/auth/", (c) => c.redirect("/api/auth/docs", 302));

function registerProxyRoute(route: ProxyRoute) {
  const handler = async (c: Context) => {
    try {
      const upstreamUrl = createUpstreamUrl(c.req.url, route);
      const headers = new Headers(c.req.raw.headers);
      const forwardedFor =
        c.req.header("x-forwarded-for") ??
        c.req.header("x-real-ip") ??
        c.req.header("cf-connecting-ip");
      const clientIp = forwardedFor?.split(",")[0]?.trim();

      headers.set("host", new URL(route.target).host);
      headers.set("x-forwarded-host", new URL(c.req.url).host);
      headers.set("x-forwarded-proto", new URL(c.req.url).protocol.replace(":", ""));
      headers.set("x-forwarded-prefix", route.prefix);
      if (forwardedFor) {
        headers.set("x-forwarded-for", forwardedFor);
      }
      if (clientIp) {
        headers.set("x-real-ip", clientIp);
      }

      const response = await proxy(upstreamUrl, {
        raw: c.req.raw,
        headers,
      });

      logger.info("proxied request", {
        method: c.req.method,
        prefix: route.prefix,
        upstreamPath: new URL(upstreamUrl).pathname,
        status: response.status,
        target: route.target,
      });

      return response;
    } catch (error) {
      logger.error("upstream request failed", {
        method: c.req.method,
        prefix: route.prefix,
        target: route.target,
        error,
      });

      return c.json(
        {
          success: false,
          error: "Bad Gateway",
          message: `Upstream unavailable: ${route.target}`,
        },
        502
      );
    }
  };

  app.all(route.prefix, handler);
  app.all(`${route.prefix}/*`, handler);
}

for (const route of proxyRoutes) {
  registerProxyRoute(route);
}

app.notFound(createNotFoundHandler());
app.onError(createErrorHandler({ serviceName: "gateway", logger }));
await initDB({ logger, serviceName: "gateway" });

serve({ fetch: app.fetch, port: env.PORT }, () => {
  logger.info("service started", {
    port: env.PORT,
    baseUrl: `http://localhost:${env.PORT}`,
    healthPath: "/health",
  });
  for (const r of proxyRoutes) {
    logger.info("proxy route configured", {
      prefix: r.prefix,
      target: r.target,
    });
  }
});

export default app;
