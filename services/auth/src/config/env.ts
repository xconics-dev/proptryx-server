import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";
import { logger } from "@/lib/logger";

const optionalBooleanStringSchema = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => value === "true");

const optionalCookieDomainSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (!value) {
      return undefined;
    }

    return value
      .replace(/^https?:\/\//i, "")
      .replace(/\/.*$/, "")
      .replace(/^\./, "")
      .toLowerCase();
  });

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
    REDIS_URL: z.url("REDIS_URL must be a valid Redis connection string"),
    BETTER_AUTH_SECRET: z
      .string()
      .min(16, "BETTER_AUTH_SECRET must be at least 16 characters long"),
    BETTER_AUTH_URL: z.url("BETTER_AUTH_URL must be a valid URL"),
    BETTER_AUTH_CROSS_SUBDOMAIN_COOKIES: optionalBooleanStringSchema,
    BETTER_AUTH_COOKIE_DOMAIN: optionalCookieDomainSchema,
    BETTER_AUTH_API_KEY: z
      .string()
      .min(1, "BETTER_AUTH_API_KEY is required for Better Auth infrastructure"),
    GOOGLE_OAUTH_CLIENT_ID: z
      .string()
      .endsWith(
        ".apps.googleusercontent.com",
        "GOOGLE_OAUTH_CLIENT_ID must be the Google client id ending with .apps.googleusercontent.com"
      ),
    GOOGLE_OAUTH_CLIENT_SECRET: z
      .string()
      .startsWith("GOCSPX-", "GOOGLE_OAUTH_CLIENT_SECRET must be the Google client secret"),
    GST_API_KEY: z.string().min(1, "GST_API_KEY is required for GST verification"),
    RAZORPAY_KEY_ID: z.string().min(1, "RAZORPAY_KEY_ID is required for Razorpay integration"),
    RAZORPAY_KEY_SECRET: z
      .string()
      .min(1, "RAZORPAY_KEY_SECRET is required for Razorpay integration"),
    RAZORPAY_WEBHOOK_SECRET: z
      .string()
      .min(1, "RAZORPAY_WEBHOOK_SECRET is required for Razorpay webhook verification"),
    RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required for Resend transport"),
    RESEND_FROM: z.string().email("RESEND_FROM must be a valid email address"),
  },
  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.AUTH_PORT,
    LOG_LEVEL: process.env.LOG_LEVEL,
    LOG_FORMAT: process.env.LOG_FORMAT,
    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS,
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    BETTER_AUTH_CROSS_SUBDOMAIN_COOKIES: process.env.BETTER_AUTH_CROSS_SUBDOMAIN_COOKIES,
    BETTER_AUTH_COOKIE_DOMAIN: process.env.BETTER_AUTH_COOKIE_DOMAIN,
    BETTER_AUTH_API_KEY: process.env.BETTER_AUTH_API_KEY,
    GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID,
    GOOGLE_OAUTH_CLIENT_SECRET: process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    GST_API_KEY: process.env.GST_API_KEY,
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
    RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM: process.env.RESEND_FROM,
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
