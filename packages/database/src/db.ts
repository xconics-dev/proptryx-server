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

const DEFAULT_REMOTE_POOL_MAX = 5;
const DEFAULT_REMOTE_POOL_MIN = 0;
const DEFAULT_LOCAL_POOL_MAX = 20;
const DEFAULT_LOCAL_POOL_MIN = 2;
const DEFAULT_CONNECTION_TIMEOUT_MS = 15_000;
const DEFAULT_STATEMENT_TIMEOUT_MS = 20_000;
const DEFAULT_QUERY_TIMEOUT_MS = 20_000;
const DB_CONNECT_RETRY_DELAYS_MS = [0, 1_000, 2_000];

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
  const isLocal =
    parsedUrl.hostname === "localhost" ||
    parsedUrl.hostname === "127.0.0.1" ||
    parsedUrl.hostname === "::1";
  const maxConnections = parseIntegerParam(
    parsedUrl.searchParams.get("pool_max"),
    isLocal ? DEFAULT_LOCAL_POOL_MAX : DEFAULT_REMOTE_POOL_MAX
  );
  const minConnections = Math.min(
    parseIntegerParam(
      parsedUrl.searchParams.get("pool_min"),
      isLocal ? DEFAULT_LOCAL_POOL_MIN : DEFAULT_REMOTE_POOL_MIN
    ),
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
      DEFAULT_CONNECTION_TIMEOUT_MS
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
      DEFAULT_STATEMENT_TIMEOUT_MS
    ),
    query_timeout: parseIntegerParam(
      parsedUrl.searchParams.get("query_timeout_ms"),
      DEFAULT_QUERY_TIMEOUT_MS
    ),
    ssl: buildSslOptions(url),
  };
}

function sleep(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function verifyPoolConnection(
  pool: Pool,
  logger?: DBLogger,
  serviceName?: string
): Promise<void> {
  let lastError: unknown;

  for (const [attempt, delayMs] of DB_CONNECT_RETRY_DELAYS_MS.entries()) {
    if (delayMs > 0) {
      await sleep(delayMs);
    }

    try {
      await pool.query("select 1");
      return;
    } catch (error) {
      lastError = error;
      logger?.error("database connection attempt failed", {
        service: serviceName ?? "unknown",
        attempt: attempt + 1,
        maxAttempts: DB_CONNECT_RETRY_DELAYS_MS.length,
        retryDelayMs:
          attempt + 1 < DB_CONNECT_RETRY_DELAYS_MS.length
            ? DB_CONNECT_RETRY_DELAYS_MS[attempt + 1]
            : 0,
        error,
      });
    }
  }

  throw lastError;
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
    await verifyPoolConnection(pool, options.logger, options.serviceName);

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
