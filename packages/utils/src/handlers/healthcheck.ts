import type { Context } from "hono";

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

    return c.json(
      {
        success: isHealthy,
        service: options.serviceName,
        status: isHealthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        ...(checkEntries.length > 0 ? { checks: checksResult } : {}),
      },
      isHealthy ? 200 : 503
    );
  };
}
