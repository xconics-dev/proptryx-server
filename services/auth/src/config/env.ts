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

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),

    PORT: z.coerce.number().int().min(1).max(65535),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "fatal"]),
    LOG_FORMAT: z.enum(["pretty", "json"]),
    CORS_ALLOWED_ORIGINS: corsOriginsSchema,
    DATABASE_URL: z.url("DATABASE_URL must be a valid PostgreSQL connection string"),
    BETTER_AUTH_SECRET: z
      .string()
      .min(16, "BETTER_AUTH_SECRET must be at least 16 characters long"),
    BETTER_AUTH_URL: z.url("BETTER_AUTH_URL must be a valid URL"),
    BETTER_AUTH_API_KEY: z
      .string()
      .min(1, "BETTER_AUTH_API_KEY is required for Better Auth infrastructure"),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV ?? process.env.AUTH_NODE_ENV,
    PORT: process.env.PORT ?? process.env.AUTH_PORT,
    LOG_LEVEL: process.env.LOG_LEVEL ?? process.env.AUTH_LOG_LEVEL,
    LOG_FORMAT: process.env.LOG_FORMAT ?? process.env.AUTH_LOG_FORMAT,
    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS,
    DATABASE_URL: process.env.DATABASE_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET ?? process.env.AUTH_BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL ?? process.env.AUTH_BETTER_AUTH_URL,
    BETTER_AUTH_API_KEY: process.env.BETTER_AUTH_API_KEY ?? process.env.AUTH_BETTER_AUTH_API_KEY,
  },

  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",

  onValidationError(issues) {
    logger.fatal("invalid or missing environment variables");
    for (const issue of issues) {
      logger.fatal("env validation issue", {
        path: (issue.path ?? []).join("."),
        message: issue.message,
      });
    }
    logger.fatal("see environment example", {
      exampleFile: "env/.env.example",
    });
    process.exit(1);
  },
});
