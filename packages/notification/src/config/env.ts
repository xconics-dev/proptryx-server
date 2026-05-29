import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    EMAIL_PREVIEW_PORT: z.coerce.number().int().min(1).max(65535).default(3005),
    RESEND_API_KEY: z.string().min(1, "RESEND_API_KEY is required"),
    RESEND_FROM: z
      .string()
      .email("RESEND_FROM must be a valid email address")
      .min(1, "RESEND_FROM is required"),
    FIREBASE_PROJECT_ID: z.string().trim().min(1).optional(),
    FIREBASE_CLIENT_EMAIL: z.string().trim().email().optional(),
    FIREBASE_PRIVATE_KEY: z.string().trim().min(1).optional(),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    EMAIL_PREVIEW_PORT: process.env.EMAIL_PREVIEW_PORT,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM: process.env.RESEND_FROM,
    FIREBASE_PROJECT_ID: process.env.FIREBASE_PROJECT_ID,
    FIREBASE_CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY,
  },

  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
