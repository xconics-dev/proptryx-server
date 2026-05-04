import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ConnectionOptions } from "node:tls";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { Client } from "pg";

type Migration = ReturnType<typeof readMigrationFiles>[number];

type DbMigration = {
  id: number;
  hash: string;
  created_at: string | number | null;
};

type PgError = Error & {
  code?: string;
};

const MIGRATIONS_SCHEMA = "drizzle";
const MIGRATIONS_TABLE = "__drizzle_migrations";

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

function getMigrationsFolder(): string {
  const currentDir = dirname(fileURLToPath(import.meta.url));
  return resolve(currentDir, "../drizzle");
}

function getCreatedTables(migration: Migration): string[] {
  const tables = new Set<string>();

  for (const statement of migration.sql) {
    const match = statement.match(/CREATE TABLE "([^"]+)"/);
    if (match) {
      tables.add(match[1]);
    }
  }

  return [...tables];
}

async function ensureMigrationsTable(client: Client): Promise<void> {
  await client.query(`CREATE SCHEMA IF NOT EXISTS "${MIGRATIONS_SCHEMA}"`);
  await client.query(`
    CREATE TABLE IF NOT EXISTS "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);
}

async function getLastMigration(client: Client): Promise<DbMigration | null> {
  const result = await client.query<DbMigration>(
    `
      SELECT id, hash, created_at
      FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"
      ORDER BY created_at DESC
      LIMIT 1
    `
  );

  return result.rows[0] ?? null;
}

async function getAppliedMigrationHashes(client: Client): Promise<Set<string>> {
  const result = await client.query<{ hash: string }>(
    `
      SELECT hash
      FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"
    `
  );

  return new Set(result.rows.map((row) => row.hash));
}

async function getExistingTables(client: Client): Promise<Set<string>> {
  const result = await client.query<{ tablename: string }>(
    `
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
    `
  );

  return new Set(result.rows.map((row) => row.tablename));
}

async function recordMigration(client: Client, migration: Migration): Promise<void> {
  await client.query(
    `
      INSERT INTO "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}" ("hash", "created_at")
      SELECT $1, $2
      WHERE NOT EXISTS (
        SELECT 1
        FROM "${MIGRATIONS_SCHEMA}"."${MIGRATIONS_TABLE}"
        WHERE "hash" = $1
      )
    `,
    [migration.hash, migration.folderMillis]
  );
}

async function maybeBaselineFirstMigration(
  client: Client,
  migrations: Migration[],
  lastMigration: DbMigration | null,
  appliedMigrationHashes: Set<string>
): Promise<DbMigration | null> {
  if (lastMigration || migrations.length === 0) {
    return lastMigration;
  }

  const firstMigration = migrations[0];
  if (appliedMigrationHashes.has(firstMigration.hash)) {
    return {
      id: 0,
      hash: firstMigration.hash,
      created_at: firstMigration.folderMillis,
    };
  }

  const createdTables = getCreatedTables(firstMigration);
  if (createdTables.length === 0) {
    return lastMigration;
  }

  const existingTables = await getExistingTables(client);
  const existingCreatedTables = createdTables.filter((table) => existingTables.has(table));

  if (existingCreatedTables.length === 0) {
    return lastMigration;
  }

  await recordMigration(client, firstMigration);
  console.log(
    `Baselined migration ${firstMigration.hash.slice(0, 12)} because existing schema objects were detected: ${existingCreatedTables.join(", ")}.`
  );

  return {
    id: 0,
    hash: firstMigration.hash,
    created_at: firstMigration.folderMillis,
  };
}

function isIgnorableDuplicateError(error: unknown): boolean {
  const pgError = error as PgError;
  return (
    pgError.code === "42P07" ||
    pgError.code === "42710" ||
    pgError.code === "42701" ||
    pgError.code === "42704" ||
    pgError.code === "42P01" ||
    pgError.code === "42703"
  );
}

async function applyMigration(
  client: Client,
  migration: Migration,
  options: { allowDuplicateConflicts?: boolean } = {}
): Promise<void> {
  await client.query("BEGIN");

  try {
    for (const statement of migration.sql) {
      const trimmedStatement = statement.trim();
      if (!trimmedStatement) {
        continue;
      }

      if (options.allowDuplicateConflicts) {
        await client.query("SAVEPOINT drizzle_stmt");

        try {
          await client.query(trimmedStatement);
          await client.query("RELEASE SAVEPOINT drizzle_stmt");
        } catch (error) {
          await client.query("ROLLBACK TO SAVEPOINT drizzle_stmt");
          await client.query("RELEASE SAVEPOINT drizzle_stmt");

          if (isIgnorableDuplicateError(error)) {
            continue;
          }

          throw error;
        }

        continue;
      }

      await client.query(trimmedStatement);
    }

    await recordMigration(client, migration);
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
}

export async function runMigrations(): Promise<void> {
  const databaseUrl = loadDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required for migration commands");
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: buildSslOptions(databaseUrl),
  });

  const migrations = readMigrationFiles({
    migrationsFolder: getMigrationsFolder(),
  });

  await client.connect();

  try {
    await ensureMigrationsTable(client);

    const appliedMigrationHashes = await getAppliedMigrationHashes(client);
    let lastMigration = await getLastMigration(client);
    lastMigration = await maybeBaselineFirstMigration(
      client,
      migrations,
      lastMigration,
      appliedMigrationHashes
    );

    if (lastMigration) {
      appliedMigrationHashes.add(lastMigration.hash);
    }

    for (const migration of migrations) {
      if (appliedMigrationHashes.has(migration.hash)) {
        continue;
      }

      if (lastMigration && Number(lastMigration.created_at ?? 0) >= migration.folderMillis) {
        continue;
      }

      console.log(`Applying migration ${migration.hash.slice(0, 12)}...`);
      await applyMigration(client, migration, {
        allowDuplicateConflicts: true,
      });
      appliedMigrationHashes.add(migration.hash);
      lastMigration = {
        id: 0,
        hash: migration.hash,
        created_at: migration.folderMillis,
      };
    }

    console.log("Migrations completed.");
  } finally {
    await client.end();
  }
}

await runMigrations();
