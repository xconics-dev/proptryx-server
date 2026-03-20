import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import { proxy } from "hono/proxy";
import type { Context } from "hono";
import { createFaviconHandler, createHealthCheckHandler } from "@proptryx/utils";
import { logger } from "@/lib/logger";
import { createUpstreamUrl, proxyRoutes, type ProxyRoute } from "@/proxy";

const GATEWAY_TAG = "Gateway";
const AUTH_PROXY_TAG = "Auth Service (Proxied)";
const KERNEL_PROXY_TAG = "Kernel Service (Proxied)";

const gatewayHealthRoute = createRoute({
  method: "get",
  path: "/health",
  tags: [GATEWAY_TAG],
  summary: "Gateway health check",
  description: "Returns health information for the gateway service itself.",
  responses: {
    200: {
      description: "Gateway service health response",
    },
  },
});

const authRootRedirectRoute = createRoute({
  method: "get",
  path: "/api/auth",
  tags: [AUTH_PROXY_TAG],
  summary: "Auth docs entrypoint",
  description: "Redirects to the Auth service documentation endpoint.",
  responses: {
    302: {
      description: "Redirect to /api/auth/docs",
    },
  },
});

const kernelRootRedirectRoute = createRoute({
  method: "get",
  path: "/api/kernel",
  tags: [KERNEL_PROXY_TAG],
  summary: "Kernel docs entrypoint",
  description: "Redirects to the Kernel service root docs via gateway proxy scope.",
  responses: {
    302: {
      description: "Redirect to /api/kernel/",
    },
  },
});

const authHealthProxyRoute = createRoute({
  method: "get",
  path: "/api/auth/health",
  tags: [AUTH_PROXY_TAG],
  summary: "Auth health (proxied)",
  description: "Proxies auth service health status through the gateway.",
  responses: {
    200: {
      description: "Auth service health response",
    },
    502: {
      description: "Auth service upstream unavailable",
    },
  },
});

const kernelHealthProxyRoute = createRoute({
  method: "get",
  path: "/api/kernel/health",
  tags: [KERNEL_PROXY_TAG],
  summary: "Kernel health (proxied)",
  description: "Proxies kernel service health status through the gateway.",
  responses: {
    200: {
      description: "Kernel service health response",
    },
    502: {
      description: "Kernel service upstream unavailable",
    },
  },
});

function normalizeForwardedIp(value?: string) {
  if (!value) {
    return undefined;
  }

  const first = value
    .split(",")[0]
    ?.trim()
    .replace(/^\[|\]$/g, "");
  if (!first) {
    return undefined;
  }

  if (first.includes(".") && first.includes(":")) {
    const [host] = first.split(":");
    return host?.trim() || undefined;
  }

  return first;
}

function createProxyHandler(route: ProxyRoute) {
  return async (c: Context) => {
    try {
      const upstreamUrl = createUpstreamUrl(c.req.url, route);
      const headers = new Headers(c.req.raw.headers);
      const rawForwardedFor =
        c.req.header("x-forwarded-for") ??
        c.req.header("x-real-ip") ??
        c.req.header("cf-connecting-ip") ??
        c.req.header("true-client-ip") ??
        c.req.header("x-client-ip");
      const clientIp = normalizeForwardedIp(rawForwardedFor) ?? "127.0.0.1";

      headers.set("host", new URL(route.target).host);
      headers.set("x-forwarded-host", new URL(c.req.url).host);
      headers.set("x-forwarded-proto", new URL(c.req.url).protocol.replace(":", ""));
      headers.set("x-forwarded-prefix", route.prefix);
      headers.set("x-forwarded-for", clientIp);
      headers.set("x-real-ip", clientIp);

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
}

function getProxyRoute(prefix: string) {
  const route = proxyRoutes.find((candidate) => candidate.prefix === prefix);
  if (!route) {
    throw new Error(`Missing proxy route configuration for prefix: ${prefix}`);
  }

  return route;
}

export function registerGatewayRoutes(app: OpenAPIHono) {
  const faviconHandler = createFaviconHandler();
  const authProxyRoute = getProxyRoute("/api/auth");
  const kernelProxyRoute = getProxyRoute("/api/kernel");

  app.openapi(
    gatewayHealthRoute,
    createHealthCheckHandler({
      serviceName: "gateway",
      includeConnectionInfo: true,
    })
  );

  app.get("/favicon.png", faviconHandler);
  app.get("/favicon.ico", faviconHandler);

  app.openapi(authRootRedirectRoute, (c: Context) => c.redirect("/api/auth/docs", 302));
  app.get("/api/auth/", (c: Context) => c.redirect("/api/auth/docs", 302));
  app.openapi(kernelRootRedirectRoute, (c: Context) => c.redirect("/api/kernel/", 302));

  app.openapi(authHealthProxyRoute, createProxyHandler(authProxyRoute));
  app.openapi(kernelHealthProxyRoute, createProxyHandler(kernelProxyRoute));

  for (const route of proxyRoutes) {
    const handler = createProxyHandler(route);
    app.all(route.prefix, handler);
    app.all(`${route.prefix}/*`, handler);
  }
}

export function logGatewayProxyRoutes() {
  for (const route of proxyRoutes) {
    logger.info("proxy route configured", {
      prefix: route.prefix,
      target: route.target,
    });
  }
}
