import { bodyLimit } from "hono/body-limit";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { Context, Env, Hono } from "hono";
import { requestId } from "hono/request-id";
import {
  SECURITY_CORS_ALLOW_HEADERS,
  SECURITY_CORS_ALLOW_METHODS,
  SECURITY_CORS_EXPOSE_HEADERS,
} from "../functions/network";
import { createGlobalRateLimit } from "./rate-limit";

type AppLike<E extends Env = Env> = Pick<Hono<E>, "use" | "get">;

export interface AppSecurityOptions {
  corsOrigins: string[];
  maxBodySizeBytes?: number;
  exposeCorsRoute?: boolean;
  compressionThresholdBytes?: number;
  validateJsonBody?: boolean;
  enableGlobalRateLimit?: boolean;
  skipBodyLimitPaths?: string[];
  globalRateLimitSkipPaths?: string[];
}

function hasJsonContentType(contentType: string | undefined) {
  if (!contentType) {
    return false;
  }

  return contentType.toLowerCase().includes("application/json");
}

function matchesPathPrefix(path: string, candidatePath: string) {
  return path === candidatePath || path.startsWith(`${candidatePath}/`);
}

export function applyAppSecurity<E extends Env>(app: AppLike<E>, options: AppSecurityOptions) {
  const normalizedOrigins = options.corsOrigins
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const allowAll = normalizedOrigins.includes("*");
  const allowedOrigins = new Set(normalizedOrigins);
  const exposeCorsRoute = options.exposeCorsRoute ?? true;
  const validateJsonBody = options.validateJsonBody ?? false;
  const enableGlobalRateLimit = options.enableGlobalRateLimit ?? true;
  const skipBodyLimitPaths = Array.from(
    new Set(
      (options.skipBodyLimitPaths ?? [])
        .map((path) => path.trim())
        .filter((path) => path.length > 0)
    )
  );
  const globalRateLimitSkipPaths = options.globalRateLimitSkipPaths ?? [];

  app.use(
    "*",
    cors({
      origin: (origin) => {
        if (!origin) {
          return "*";
        }
        if (allowAll) {
          return origin;
        }
        return allowedOrigins.has(origin) ? origin : "";
      },
      allowMethods: [...SECURITY_CORS_ALLOW_METHODS],
      allowHeaders: [...SECURITY_CORS_ALLOW_HEADERS],
      exposeHeaders: [...SECURITY_CORS_EXPOSE_HEADERS],
      maxAge: 600,
      credentials: !allowAll,
    })
  );

  app.use("*", requestId());
  if (enableGlobalRateLimit) {
    const defaultRateLimitSkips = exposeCorsRoute ? ["/health", "/cors"] : ["/health"];
    app.use(
      "*",
      createGlobalRateLimit({
        skipPaths: [...defaultRateLimitSkips, ...globalRateLimitSkipPaths],
      })
    );
  }
  app.use("*", secureHeaders());
  app.use("*", compress({ threshold: options.compressionThresholdBytes ?? 2048 }));

  if (exposeCorsRoute) {
    app.get("/cors", (c: Context) =>
      c.json({
        success: true,
        cors: {
          allowAll,
          origins: normalizedOrigins,
        },
      })
    );
  }

  const bodyLimitMiddleware = bodyLimit({
    maxSize: options.maxBodySizeBytes ?? 1024 * 1024 * 5, // default to 5MB
    onError: (c) =>
      c.json(
        {
          success: false,
          error: "Payload Too Large",
          message: "Request body exceeds allowed size",
        },
        413
      ),
  });

  app.use("*", async (c, next) => {
    const shouldSkipBodyLimit = skipBodyLimitPaths.some((skipPath) =>
      matchesPathPrefix(c.req.path, skipPath)
    );

    if (shouldSkipBodyLimit) {
      await next();
      return;
    }

    await bodyLimitMiddleware(c, next);
  });

  if (!validateJsonBody) {
    return;
  }

  app.use("*", async (c, next) => {
    const method = c.req.method;
    if (!["POST", "PUT", "PATCH"].includes(method)) {
      await next();
      return;
    }

    if (!hasJsonContentType(c.req.header("content-type"))) {
      await next();
      return;
    }

    if (c.req.header("content-length") === "0") {
      await next();
      return;
    }

    try {
      await c.req.raw.clone().json();
      await next();
    } catch {
      return c.json(
        {
          success: false,
          error: "Bad Request",
          message: "Invalid JSON body",
        },
        400
      );
    }
  });
}
