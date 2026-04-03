import { linode } from "@better-upload/server/clients";

import { env } from "./env";

export const linodeClient: ReturnType<typeof linode> = linode({
  region: env.BUCKET_REGION,
  accessKey: env.BUCKET_ACCESS_KEY,
  secretKey: env.BUCKET_SECRET_KEY,
});

export const bucketName = env.BUCKET_NAME;
