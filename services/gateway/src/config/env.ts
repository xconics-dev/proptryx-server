import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { logger } from "@/lib/logger";

const corsOriginsSchema = z
  .string()
  .min(1, "CORS_ALLOWED_ORIGINS is required")
  .transform((value) =>
    value
      .split(",")
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0)
  )
  .refine((origins) => origins.length > 0, {
    message: "CORS_ALLOWED_ORIGINS must contain at least one origin",
  });

/**
 * Typesafe env for the gateway service.
 *
 * Uses @t3-oss/env-core (not env-nextjs) — plain Node/Hono, no Next.js runtime.
 * Validation fires once at process startup and exits cleanly on any failure.
 * During `docker build` set SKIP_ENV_VALIDATION=true; real values arrive at runtime.
 */
export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),

    PORT: z.coerce.number().int().min(1).max(65535),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "fatal"]),
    LOG_FORMAT: z.enum(["pretty", "json"]),
    CORS_ALLOWED_ORIGINS: corsOriginsSchema,
    DATABASE_URL: z.url("DATABASE_URL must be a valid PostgreSQL connection string"),
    REDIS_URL: z.url("REDIS_URL must be a valid Redis connection string"),

    AUTH_SERVICE_URL: z.url("AUTH_SERVICE_URL must be a valid URL — e.g. http://auth:6001"),

    PROPERTY_SERVICE_URL: z.url(
      "PROPERTY_SERVICE_URL must be a valid URL — e.g. http://property:6002"
    ),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.GATEWAY_PORT,
    LOG_LEVEL: process.env.LOG_LEVEL,
    LOG_FORMAT: process.env.LOG_FORMAT,
    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL,
    PROPERTY_SERVICE_URL: process.env.PROPERTY_SERVICE_URL,
  },

  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",

  onValidationError(issues) {
    const normalizedIssues = Array.isArray(issues) ? issues : issues;
    logger.fatal("invalid or missing environment variables");
    for (const issue of normalizedIssues) {
      logger.fatal("env validation issue", {
        path: issue.path.join("."),
        message: issue.message,
      });
    }
    logger.fatal("see environment example", {
      exampleFile: "env/.env.example",
    });
    process.exit(1);
  },
});
