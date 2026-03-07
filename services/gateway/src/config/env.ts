import { logger } from "@/lib/logger";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

/**
 * Typesafe env for the gateway service.
 *
 * Uses @t3-oss/env-core (not env-nextjs) — plain Node/Hono, no Next.js runtime.
 * Validation fires once at process startup and exits cleanly on any failure.
 * During `docker build` set SKIP_ENV_VALIDATION=true; real values arrive at runtime.
 */
export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    PORT: z.coerce
      .number({ invalid_type_error: "PORT must be a number" })
      .int()
      .min(1)
      .max(65535)
      .default(3000),
    LOG_LEVEL: z
      .enum(["debug", "info", "warn", "error", "fatal"])
      .default("info"),
    LOG_FORMAT: z.enum(["pretty", "json"]).default("pretty"),

    AUTH_SERVICE_URL: z
      .string()
      .url("AUTH_SERVICE_URL must be a valid URL — e.g. http://auth:3001"),

    PROPERTY_SERVICE_URL: z
      .string()
      .url(
        "PROPERTY_SERVICE_URL must be a valid URL — e.g. http://property:3002"
      ),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    LOG_LEVEL: process.env.LOG_LEVEL,
    LOG_FORMAT: process.env.LOG_FORMAT,
    AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL,
    PROPERTY_SERVICE_URL: process.env.PROPERTY_SERVICE_URL,
  },

  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",

  onValidationError(issues) {
    const normalizedIssues = Array.isArray(issues) ? issues : issues.errors;
    logger.fatal("invalid or missing environment variables");
    for (const issue of normalizedIssues) {
      logger.fatal("env validation issue", {
        path: issue.path.join("."),
        message: issue.message,
      });
    }
    logger.fatal("see environment example", {
      exampleFile: "services/gateway/.env.example",
    });
    process.exit(1);
  },
});
