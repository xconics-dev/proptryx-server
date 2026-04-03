import { z } from "zod";

const uploaderEnvSchema = z.object({
  BUCKET_REGION: z
    .string()
    .min(1, "BUCKET_REGION is required")
    .describe("Linode Object Storage region"),
  BUCKET_ACCESS_KEY: z.string().min(1, "BUCKET_ACCESS_KEY is required"),
  BUCKET_SECRET_KEY: z.string().min(1, "BUCKET_SECRET_KEY is required"),
  BUCKET_NAME: z.string().min(1, "BUCKET_NAME is required"),
});

export const env = uploaderEnvSchema.parse({
  BUCKET_REGION: process.env.BUCKET_REGION,
  BUCKET_ACCESS_KEY: process.env.BUCKET_ACCESS_KEY,
  BUCKET_SECRET_KEY: process.env.BUCKET_SECRET_KEY,
  BUCKET_NAME: process.env.BUCKET_NAME,
});

export type UploaderEnv = typeof env;
