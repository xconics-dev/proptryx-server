import { createHash, createHmac } from "node:crypto";
import { logger } from "@/lib/logger";

const getStorageConfig = () => {
  const bucketName = process.env.BUCKET_NAME;
  const bucketRegion = process.env.BUCKET_REGION;
  const accessKey = process.env.BUCKET_ACCESS_KEY;
  const secretKey = process.env.BUCKET_SECRET_KEY;

  if (!(bucketName && bucketRegion && accessKey && secretKey)) {
    return null;
  }

  return {
    accessKey,
    bucketName,
    bucketRegion,
    host: `${bucketName}.${bucketRegion}.linodeobjects.com`,
    secretKey,
  };
};

const hmac = (key: string | Buffer, value: string) =>
  createHmac("sha256", key).update(value).digest();
const hash = (value: string) => createHash("sha256").update(value).digest("hex");

const getSigningKey = (secretKey: string, dateStamp: string, region: string) => {
  const dateKey = hmac(`AWS4${secretKey}`, dateStamp);
  const dateRegionKey = hmac(dateKey, region);
  const dateRegionServiceKey = hmac(dateRegionKey, "s3");
  return hmac(dateRegionServiceKey, "aws4_request");
};

export const extractUploadObjectKey = (value?: string | null) => {
  if (!value) {
    return null;
  }

  if (!/^https?:\/\//i.test(value)) {
    return value.replace(/^\/+/, "") || null;
  }

  try {
    const url = new URL(value);
    return decodeURIComponent(url.pathname.replace(/^\/+/, "")) || null;
  } catch {
    return null;
  }
};

export const deleteUploadObjects = async (values: Array<string | null | undefined>) => {
  const config = getStorageConfig();
  const keys = Array.from(
    new Set(values.map(extractUploadObjectKey).filter((key): key is string => Boolean(key)))
  );

  if (!(config && keys.length > 0)) {
    return;
  }

  await Promise.allSettled(
    keys.map(async (key) => {
      const encodedKey = key.split("/").map(encodeURIComponent).join("/");
      const now = new Date();
      const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
      const dateStamp = amzDate.slice(0, 8);
      const payloadHash = hash("");
      const canonicalHeaders = `host:${config.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
      const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
      const canonicalRequest = [
        "DELETE",
        `/${encodedKey}`,
        "",
        canonicalHeaders,
        signedHeaders,
        payloadHash,
      ].join("\n");
      const credentialScope = `${dateStamp}/${config.bucketRegion}/s3/aws4_request`;
      const stringToSign = [
        "AWS4-HMAC-SHA256",
        amzDate,
        credentialScope,
        hash(canonicalRequest),
      ].join("\n");
      const signature = createHmac(
        "sha256",
        getSigningKey(config.secretKey, dateStamp, config.bucketRegion)
      )
        .update(stringToSign)
        .digest("hex");
      const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
      const response = await fetch(`https://${config.host}/${encodedKey}`, {
        method: "DELETE",
        headers: {
          Authorization: authorization,
          "x-amz-content-sha256": payloadHash,
          "x-amz-date": amzDate,
        },
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`Object delete failed for ${key}: ${response.status}`);
      }
    })
  ).then((results) => {
    for (const result of results) {
      if (result.status === "rejected") {
        logger.warn("failed to delete uploaded object", { error: result.reason });
      }
    }
  });
};
