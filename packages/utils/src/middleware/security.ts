import { bodyLimit } from "hono/body-limit";
import { compress } from "hono/compress";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import type { Context, Hono } from "hono";
import { requestId } from "hono/request-id";
import { createGlobalRateLimit } from "./rate-limit";

type AppLike = Pick<Hono, "use" | "get">;

export interface AppSecurityOptions {
  corsOrigins: string[];
  maxBodySizeBytes?: number;
  exposeCorsRoute?: boolean;
  compressionThresholdBytes?: number;
  validateJsonBody?: boolean;
  enableGlobalRateLimit?: boolean;
}

function hasJsonContentType(contentType: string | undefined) {
  if (!contentType) {
    return false;
  }

  return contentType.toLowerCase().includes("application/json");
}

export function applyAppSecurity(app: AppLike, options: AppSecurityOptions) {
  const normalizedOrigins = options.corsOrigins
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
  const allowAll = normalizedOrigins.includes("*");
  const allowedOrigins = new Set(normalizedOrigins);
  const exposeCorsRoute = options.exposeCorsRoute ?? true;
  const validateJsonBody = options.validateJsonBody ?? false;
  const enableGlobalRateLimit = options.enableGlobalRateLimit ?? true;

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
      allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization", "X-Request-Id", "Set-Auth-Token"],
      exposeHeaders: ["X-Request-Id", "Set-Auth-Token"],
      maxAge: 600,
      credentials: !allowAll,
    })
  );

  app.use("*", requestId());
  if (enableGlobalRateLimit) {
    app.use(
      "*",
      createGlobalRateLimit({
        skipPaths: exposeCorsRoute ? ["/health", "/cors"] : ["/health"],
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

  app.use(
    "*",
    bodyLimit({
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
    })
  );

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
