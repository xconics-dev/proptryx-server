import type { ConnectionOptions } from "node:tls";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool, type PoolConfig } from "pg";
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

function parseIntegerParam(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function parseBooleanParam(value: string | null, fallback: boolean): boolean {
  if (!value) {
    return fallback;
  }

  return value === "1" || value.toLowerCase() === "true";
}

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

function buildPoolConfig(url: string, serviceName?: string): PoolConfig {
  const parsedUrl = new URL(url);
  const maxConnections = parseIntegerParam(parsedUrl.searchParams.get("pool_max"), 20);
  const minConnections = Math.min(
    parseIntegerParam(parsedUrl.searchParams.get("pool_min"), 2),
    maxConnections
  );

  return {
    connectionString: url,
    application_name: serviceName ? `proptryx-${serviceName}` : "proptryx",
    max: maxConnections,
    min: minConnections,
    idleTimeoutMillis: parseIntegerParam(parsedUrl.searchParams.get("idle_timeout_ms"), 10_000),
    connectionTimeoutMillis: parseIntegerParam(
      parsedUrl.searchParams.get("connect_timeout_ms"),
      5_000
    ),
    maxUses: parseIntegerParam(parsedUrl.searchParams.get("max_uses"), 7_500),
    maxLifetimeSeconds: parseIntegerParam(
      parsedUrl.searchParams.get("max_lifetime_seconds"),
      60 * 30
    ),
    keepAlive: parseBooleanParam(parsedUrl.searchParams.get("keep_alive"), true),
    keepAliveInitialDelayMillis: parseIntegerParam(
      parsedUrl.searchParams.get("keep_alive_initial_delay_ms"),
      10_000
    ),
    statement_timeout: parseIntegerParam(
      parsedUrl.searchParams.get("statement_timeout_ms"),
      15_000
    ),
    query_timeout: parseIntegerParam(parsedUrl.searchParams.get("query_timeout_ms"), 15_000),
    ssl: buildSslOptions(url),
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

    pool = new Pool(buildPoolConfig(url, options.serviceName));

    db = drizzle(pool, { schema });
    await pool.query("select 1");

    options.logger?.info("database connected", {
      service: options.serviceName ?? "unknown",
      adapter: "drizzle-orm/node-postgres",
      tlsMinVersion: "TLSv1.2",
      maxPoolSize: pool.options.max,
      minPoolSize: pool.options.min,
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
