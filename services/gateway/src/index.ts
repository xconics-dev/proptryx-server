import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { proxyRequest, proxyRoutes } from "@/proxy";
import healthRoute from "@/routes/health";
import { createHonoRequestLogger } from "@proptryx/logger";
import { Hono } from "hono";

// ── Hono app (non-proxy routes only) ─────────────────────────────────────────
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

// ── Request handler ───────────────────────────────────────────────────────────
//
// Proxy requests are handled at the raw Node level — Hono never sees them.
// This is the only correct way to avoid ERR_HTTP_HEADERS_SENT:
// @hono/node-server unconditionally calls responseViaResponseObject() after
// your handler returns, which double-writes headers if the proxy already
// wrote to the ServerResponse.
//
async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = req.url ?? "/";

  // ── 1. Proxy routes ────────────────────────────────────────────────────────
  const route = proxyRoutes.find((r) => url.startsWith(r.prefix));
  if (route) {
    await proxyRequest(req, res, route);
    return; // res already ended by the proxy stream
  }

  // ── 2. Everything else → Hono ─────────────────────────────────────────────
  const request = new Request(new URL(url, `http://localhost:${env.PORT}`), {
    method: req.method ?? "GET",
    headers: req.headers as Record<string, string | string[]>,
    // Don't set body for GET/HEAD — ReadableStream from IncomingMessage
    body:
      req.method === "GET" || req.method === "HEAD"
        ? undefined
        : (req as unknown as ReadableStream),
    duplex: "half",
  });

  const response = await app.fetch(request);
  const body = response.body ? Buffer.from(await response.arrayBuffer()) : null;

  res.writeHead(response.status, Object.fromEntries(response.headers));
  if (body) {
    res.write(body);
  }
  res.end();
}

// ── Server ────────────────────────────────────────────────────────────────────
const server = createServer((req, res) => {
  handler(req, res).catch((err) => {
    logger.error("gateway request handler failed", { error: err });
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ success: false, error: "Internal Server Error" })
      );
    }
  });
});

server.listen(env.PORT, () => {
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
