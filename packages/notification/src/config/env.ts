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
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    EMAIL_PREVIEW_PORT: process.env.EMAIL_PREVIEW_PORT,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    RESEND_FROM: process.env.RESEND_FROM,
  },

  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
