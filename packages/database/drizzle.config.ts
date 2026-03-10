/** biome-ignore-all assist/source/organizeImports:forced */
import { defineConfig } from "drizzle-kit";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { ConnectionOptions } from "node:tls";

function loadDatabaseUrl(): string | undefined {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const envPath = resolve(process.cwd(), "../../env/.env");
  if (!existsSync(envPath)) {
    return undefined;
  }

  const lines = readFileSync(envPath, "utf8").split("\n");
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) {
      continue;
    }
    const [key, ...valueParts] = trimmedLine.split("=");
    if (key === "DATABASE_URL") {
      return valueParts.join("=").trim();
    }
  }

  return undefined;
}

const databaseUrl = loadDatabaseUrl();

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required for drizzle-kit commands");
}

const url = new URL(databaseUrl);

if (!["postgres:", "postgresql:"].includes(url.protocol)) {
  throw new Error("DATABASE_URL must use postgres:// or postgresql:// protocol");
}

const tlsCiphers = [
  "TLS_AES_128_GCM_SHA256",
  "TLS_AES_256_GCM_SHA384",
  "TLS_CHACHA20_POLY1305_SHA256",
  "ECDHE-RSA-AES128-GCM-SHA256",
  "ECDHE-RSA-CHACHA20-POLY1305",
  "ECDHE-RSA-AES256-GCM-SHA384",
].join(":");

const sslMode = url.searchParams.get("sslmode");
const isLocalHost = url.hostname === "localhost" || url.hostname === "127.0.0.1";

const ssl: ConnectionOptions | undefined =
  sslMode === "disable" || (isLocalHost && !sslMode)
    ? undefined
    : {
        minVersion: "TLSv1.2",
        ciphers: tlsCiphers,
        rejectUnauthorized: sslMode === "verify-full",
      };

export default defineConfig({
  out: "./drizzle",
  schema: "./src/schemas/**/*.ts",
  dialect: "postgresql",
  dbCredentials: {
    host: url.hostname,
    port: Number(url.port || "5432"),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, "")),
    ...(ssl ? { ssl } : {}),
  },
});
