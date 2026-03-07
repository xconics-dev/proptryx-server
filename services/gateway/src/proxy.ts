import {
  type IncomingMessage,
  type ServerResponse,
  request as httpRequest,
} from "node:http";
import { request as httpsRequest } from "node:https";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";

export interface ProxyRoute {
  prefix: string;
  target: string;
}

/**
 * Route table — strip the prefix, forward to the upstream.
 * Built once at startup; O(n) match on each request (n=2, effectively O(1)).
 */
export const proxyRoutes: ProxyRoute[] = [
  { prefix: "/api/auth", target: env.AUTH_SERVICE_URL },
  { prefix: "/api/property", target: env.PROPERTY_SERVICE_URL },
];

// Parse targets once at startup — avoids repeated URL parsing per request
const parsedTargets = new Map(
  proxyRoutes.map((r) => [r.prefix, new URL(r.target)])
);

/**
 * Ultra-lean streaming proxy using Node's built-in http/https modules.
 *
 * Why not undici.fetch / http-proxy-middleware?
 *   - undici.fetch buffers the full body before forwarding (bad for large payloads)
 *   - http-proxy-middleware is ~200kb of Connect middleware overhead
 *   - Node's http.request streams request AND response bodies with zero buffering
 *     and zero extra dependencies
 *
 * Flow: client req → pipe → upstream req → pipe → client res
 * Memory: O(chunk size), not O(body size)
 */
export function proxyRequest(
  req: IncomingMessage,
  res: ServerResponse,
  route: ProxyRoute
): Promise<void> {
  return new Promise((resolve, reject) => {
    // biome-ignore lint/style/noNonNullAssertion: <explanation>
    const target = parsedTargets.get(route.prefix)!;
    const isHttps = target.protocol === "https:";
    const reqFn = isHttps ? httpsRequest : httpRequest;

    // Strip the prefix from the path
    const upstreamPath = (req.url ?? "/").replace(route.prefix, "") || "/";

    const options = {
      hostname: target.hostname,
      port: target.port || (isHttps ? 443 : 80),
      path: upstreamPath,
      method: req.method,
      // Forward all original headers, overwrite host to match upstream
      headers: { ...req.headers, host: target.host },
    };

    const proxyReq = reqFn(options, (proxyRes) => {
      logger.info("proxied request", {
        method: req.method ?? "GET",
        prefix: route.prefix,
        upstreamPath,
        status: proxyRes.statusCode ?? 502,
        target: route.target,
      });

      // Write upstream status + headers directly to client response
      res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);

      // Stream upstream body → client with zero buffering
      proxyRes.pipe(res, { end: true });
      proxyRes.on("end", resolve);
      proxyRes.on("error", reject);
    });

    proxyReq.on("error", (err) => {
      logger.error("upstream request failed", {
        method: req.method ?? "GET",
        prefix: route.prefix,
        target: route.target,
        error: err,
      });
      if (!res.headersSent) {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            success: false,
            error: "Bad Gateway",
            message: `Upstream unavailable: ${route.target}`,
          })
        );
      }
      resolve(); // don't reject — response was handled
    });

    // Stream client request body → upstream with zero buffering
    req.pipe(proxyReq, { end: true });
  });
}
