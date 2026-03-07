import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { logger } from "@/lib/logger";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

    PORT: z.coerce
      .number({ invalid_type_error: "PORT must be a number" })
      .int()
      .min(1)
      .max(65535)
      .default(3001),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "fatal"]).default("info"),
    LOG_FORMAT: z.enum(["pretty", "json"]).default("pretty"),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    LOG_LEVEL: process.env.LOG_LEVEL,
    LOG_FORMAT: process.env.LOG_FORMAT,
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
      exampleFile: "services/auth/.env.example",
    });
    process.exit(1);
  },
});
