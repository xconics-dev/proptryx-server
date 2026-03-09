import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { logger } from "@/lib/logger";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]),

    PORT: z.coerce.number().int().min(1).max(65535),
    LOG_LEVEL: z.enum(["debug", "info", "warn", "error", "fatal"]),
    LOG_FORMAT: z.enum(["pretty", "json"]),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV ?? process.env.PROPERTY_NODE_ENV,
    PORT: process.env.PORT ?? process.env.PROPERTY_PORT,
    LOG_LEVEL: process.env.LOG_LEVEL ?? process.env.PROPERTY_LOG_LEVEL,
    LOG_FORMAT: process.env.LOG_FORMAT ?? process.env.PROPERTY_LOG_FORMAT,
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
