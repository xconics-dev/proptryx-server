import type { ConnectionOptions } from "node:tls";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schemas";

export type DB = ReturnType<typeof drizzle>;
export let db: DB;

type DBLogMeta = Record<string, unknown>;

type DBLogger = {
  info: (message: string, meta?: DBLogMeta) => void;
  error: (message: string, meta?: DBLogMeta) => void;
};

type InitDBOptions = {
  databaseUrl?: string;
  logger?: DBLogger;
  serviceName?: string;
};

let pool: Pool | null = null;
let initPromise: Promise<DB> | null = null;

function resolveDatabaseUrl(databaseUrl?: string): string {
  const url = databaseUrl ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is required to initialize the database");
  }
  return url;
}

function buildSslOptions(url: string): ConnectionOptions | undefined {
  const parsedUrl = new URL(url);
  const sslMode = parsedUrl.searchParams.get("sslmode");
  if (sslMode === "disable") {
    return undefined;
  }

  const host = parsedUrl.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1";
  if (isLocal && !sslMode) {
    return undefined;
  }

  const ciphers = [
    "TLS_AES_128_GCM_SHA256",
    "TLS_AES_256_GCM_SHA384",
    "TLS_CHACHA20_POLY1305_SHA256",
    "ECDHE-RSA-AES128-GCM-SHA256",
    "ECDHE-RSA-CHACHA20-POLY1305",
    "ECDHE-RSA-AES256-GCM-SHA384",
  ].join(":");

  return {
    minVersion: "TLSv1.2",
    ciphers,
    rejectUnauthorized: sslMode === "verify-full",
  };
}

export async function initDB(options: InitDBOptions = {}): Promise<DB> {
  if (db) {
    return db;
  }

  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    const url = resolveDatabaseUrl(options.databaseUrl);

    pool = new Pool({
      connectionString: url,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: buildSslOptions(url),
    });

    db = drizzle(pool, { schema });
    await pool.query("select 1");

    options.logger?.info("database connected", {
      service: options.serviceName ?? "unknown",
      adapter: "drizzle-orm/node-postgres",
      tlsMinVersion: "TLSv1.2",
    });

    return db;
  })().catch(async (error) => {
    options.logger?.error("database connection failed", {
      service: options.serviceName ?? "unknown",
      error,
    });
    initPromise = null;
    if (pool) {
      await pool.end().catch(() => undefined);
      pool = null;
    }
    throw error;
  });

  return initPromise;
}

export function getDB(): DB {
  if (!db) {
    throw new Error("Database is not initialized. Call initDB() first.");
  }
  return db;
}

export async function closeDB(): Promise<void> {
  initPromise = null;
  if (pool) {
    await pool.end();
    pool = null;
  }
}
