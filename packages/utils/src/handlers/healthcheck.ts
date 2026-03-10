import type { Context } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";

export type HealthCheckCheckResult =
  | boolean
  | {
      healthy: boolean;
      message?: string;
      details?: Record<string, unknown>;
    };

export type HealthCheckProbe = () => HealthCheckCheckResult | Promise<HealthCheckCheckResult>;

export interface HealthCheckOptions {
  serviceName: string;
  checks?: Record<string, HealthCheckProbe>;
  includeConnectionInfo?: boolean;
}

function normalizeCheckResult(result: HealthCheckCheckResult) {
  if (typeof result === "boolean") {
    return {
      healthy: result,
      message: undefined,
      details: undefined,
    };
  }

  return {
    healthy: result.healthy,
    message: result.message,
    details: result.details,
  };
}

function normalizeIp(rawValue: string | undefined): string | null {
  if (!rawValue) {
    return null;
  }

  const trimmed = rawValue.trim();
  if (!trimmed) {
    return null;
  }

  // RFC 7239 Forwarded format example: for=192.0.2.43;proto=http
  if (trimmed.toLowerCase().startsWith("for=")) {
    const forwardedValue = trimmed.split(";")[0].replace(/^for=/i, "").replace(/^"|"$/g, "").trim();
    return normalizeIp(forwardedValue);
  }

  // IPv6 in brackets: [::1]:1234
  if (trimmed.startsWith("[") && trimmed.includes("]")) {
    return trimmed.slice(1, trimmed.indexOf("]"));
  }

  const withoutIpv4MappedPrefix = trimmed.replace(/^::ffff:/i, "");
  if (withoutIpv4MappedPrefix === "::1") {
    return "127.0.0.1";
  }
  return withoutIpv4MappedPrefix;
}

function resolveClientIp(c: Context): string {
  try {
    const nodeConnIp = normalizeIp(getConnInfo(c).remote.address);
    if (nodeConnIp) {
      return nodeConnIp;
    }
  } catch {
    // Non-node runtime or missing adapter bindings.
  }

  const headerCandidates = [
    c.req.header("x-forwarded-for")?.split(",")[0],
    c.req.header("x-real-ip"),
    c.req.header("cf-connecting-ip"),
    c.req.header("true-client-ip"),
    c.req.header("x-client-ip"),
    c.req.header("forwarded"),
  ];

  for (const candidate of headerCandidates) {
    const normalized = normalizeIp(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return process.env.NODE_ENV === "development" ? "127.0.0.1" : "unknown";
}

export function createHealthCheckHandler(options: HealthCheckOptions) {
  return async (c: Context) => {
    const checks = options.checks ?? {};
    const checkEntries = await Promise.all(
      Object.entries(checks).map(async ([name, check]) => {
        try {
          const normalizedResult = normalizeCheckResult(await check());
          return [name, normalizedResult] as const;
        } catch (error) {
          return [
            name,
            {
              healthy: false,
              message: "Health check failed",
              details: { error: error instanceof Error ? error.message : "Unknown error" },
            },
          ] as const;
        }
      })
    );

    const checksResult = Object.fromEntries(
      checkEntries.map(([name, result]) => [
        name,
        {
          status: result.healthy ? "healthy" : "unhealthy",
          ...(result.message ? { message: result.message } : {}),
          ...(result.details ? { details: result.details } : {}),
        },
      ])
    );

    const isHealthy = checkEntries.every(([, result]) => result.healthy);
    const shouldIncludeConnectionInfo = options.includeConnectionInfo ?? true;

    return c.json(
      {
        success: isHealthy,
        service: options.serviceName,
        status: isHealthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        ...(shouldIncludeConnectionInfo
          ? {
              request: {
                ip: resolveClientIp(c),
                userAgent: c.req.header("user-agent") ?? null,
              },
            }
          : {}),
        ...(checkEntries.length > 0 ? { checks: checksResult } : {}),
      },
      isHealthy ? 200 : 503
    );
  };
}
