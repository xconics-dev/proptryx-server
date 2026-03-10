import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    REDIS_URL: z.url("REDIS_URL must be a valid Redis connection string"),
  },

  runtimeEnv: {
    REDIS_URL: process.env.REDIS_URL,
  },

  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",
});
