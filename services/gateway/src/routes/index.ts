import { createRoute, type OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import {
  createFaviconHandler,
  createHealthCheckHandler,
  resolveClientIpFromHeaderGetter,
} from "@proptryx/utils";
import { logger } from "@/lib/logger";
import { createUpstreamUrl, proxyRoutes, type ProxyRoute } from "@/proxy";

const GATEWAY_TAG = "Gateway";
const AUTH_PROXY_TAG = "Auth Service (Proxied)";
const COMPANY_PROXY_TAG = "Company Service (Proxied)";
const KERNEL_PROXY_TAG = "Kernel Service (Proxied)";
const NOTIFICATION_PROXY_TAG = "Notification Service (Proxied)";
const HOP_BY_HOP_REQUEST_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);
const HOP_BY_HOP_RESPONSE_HEADERS = new Set([
  "connection",
  "content-encoding",
  "content-length",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
]);

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

const companyRootRedirectRoute = createRoute({
  method: "get",
  path: "/api/company",
  tags: [COMPANY_PROXY_TAG],
  summary: "Company docs entrypoint",
  description: "Redirects to the Company service root docs via gateway proxy scope.",
  responses: {
    302: {
      description: "Redirect to /api/company/",
    },
  },
});

const notificationRootRedirectRoute = createRoute({
  method: "get",
  path: "/api/notifications",
  tags: [NOTIFICATION_PROXY_TAG],
  summary: "Notification docs entrypoint",
  description: "Redirects to the Notification service root docs via gateway proxy scope.",
  responses: {
    302: {
      description: "Redirect to /api/notifications/",
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

const companyHealthProxyRoute = createRoute({
  method: "get",
  path: "/api/company/health",
  tags: [COMPANY_PROXY_TAG],
  summary: "Company health (proxied)",
  description: "Proxies company service health status through the gateway.",
  responses: {
    200: {
      description: "Company service health response",
    },
    502: {
      description: "Company service upstream unavailable",
    },
  },
});

const notificationHealthProxyRoute = createRoute({
  method: "get",
  path: "/api/notifications/health",
  tags: [NOTIFICATION_PROXY_TAG],
  summary: "Notification health (proxied)",
  description: "Proxies notification service health status through the gateway.",
  responses: {
    200: {
      description: "Notification service health response",
    },
    502: {
      description: "Notification service upstream unavailable",
    },
  },
});

function sanitizeRequestHeaders(source: Headers) {
  const headers = new Headers();

  for (const [key, value] of source.entries()) {
    if (HOP_BY_HOP_REQUEST_HEADERS.has(key.toLowerCase())) {
      continue;
    }

    headers.set(key, value);
  }

  return headers;
}

function sanitizeResponseHeaders(source: Headers) {
  const headers = new Headers();
  const responseHeaders = source as Headers & {
    getSetCookie?: () => string[];
  };

  for (const [key, value] of source.entries()) {
    const normalizedKey = key.toLowerCase();

    if (HOP_BY_HOP_RESPONSE_HEADERS.has(normalizedKey) || normalizedKey === "set-cookie") {
      continue;
    }

    headers.set(key, value);
  }

  if (typeof responseHeaders.getSetCookie === "function") {
    for (const cookie of responseHeaders.getSetCookie()) {
      headers.append("set-cookie", cookie);
    }
  } else {
    const setCookie = source.get("set-cookie");

    if (setCookie) {
      headers.append("set-cookie", setCookie);
    }
  }

  return headers;
}

function createProxyHandler(route: ProxyRoute) {
  return async (c: Context) => {
    try {
      const upstreamUrl = createUpstreamUrl(c.req.url, route);
      const headers = sanitizeRequestHeaders(c.req.raw.headers);
      const clientIp =
        resolveClientIpFromHeaderGetter((headerName) => c.req.header(headerName)) ?? "127.0.0.1";

      headers.set("host", new URL(route.target).host);
      headers.set("accept-encoding", "identity");
      headers.set("x-forwarded-host", new URL(c.req.url).host);
      headers.set("x-forwarded-proto", new URL(c.req.url).protocol.replace(":", ""));
      headers.set("x-forwarded-prefix", route.prefix);
      headers.set("x-forwarded-for", clientIp);
      headers.set("x-real-ip", clientIp);

      const requestBody =
        c.req.method === "GET" || c.req.method === "HEAD" ? undefined : await c.req.arrayBuffer();

      const response = await fetch(upstreamUrl, {
        method: c.req.method,
        headers,
        body: requestBody,
        redirect: "manual",
        duplex: c.req.method === "GET" || c.req.method === "HEAD" ? undefined : "half",
      });

      logger.info("proxied request", {
        method: c.req.method,
        prefix: route.prefix,
        upstreamPath: new URL(upstreamUrl).pathname,
        status: response.status,
        target: route.target,
      });

      const responseBody =
        c.req.method === "HEAD" || response.status === 204 || response.status === 304
          ? undefined
          : await response.arrayBuffer();

      return new Response(responseBody, {
        status: response.status,
        statusText: response.statusText,
        headers: sanitizeResponseHeaders(response.headers),
      });
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
  const companyProxyRoute = getProxyRoute("/api/company");
  const kernelProxyRoute = getProxyRoute("/api/kernel");
  const notificationProxyRoute = getProxyRoute("/api/notifications");

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
  app.openapi(companyRootRedirectRoute, (c: Context) => c.redirect("/api/company/", 302));
  app.get("/api/company/", (c: Context) => c.redirect("/api/company/docs", 302));
  app.openapi(kernelRootRedirectRoute, (c: Context) => c.redirect("/api/kernel/", 302));
  app.openapi(notificationRootRedirectRoute, (c: Context) =>
    c.redirect("/api/notifications/", 302)
  );
  app.get("/api/notifications/", (c: Context) => c.redirect("/api/notifications/docs", 302));

  app.openapi(authHealthProxyRoute, createProxyHandler(authProxyRoute));
  app.openapi(companyHealthProxyRoute, createProxyHandler(companyProxyRoute));
  app.openapi(kernelHealthProxyRoute, createProxyHandler(kernelProxyRoute));
  app.openapi(notificationHealthProxyRoute, createProxyHandler(notificationProxyRoute));

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
