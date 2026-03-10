import { closeRedisClient, getRedisClient } from "../packages/utils/src/redis";

const args = new Set(process.argv.slice(2));
const shouldExecute = args.has("--execute");
const shouldHelp = args.has("--help") || args.has("-h");

const LEGACY_PATTERNS = [
  "proptryx-ratelimiter:*:unknown:*",
  "proptryx-ratelimiter:*:127.0.0.1:*",
  "proptryx-ratelimiter:*:localhost:*",
  "proptryx-authsession*",
];

function printHelp() {
  process.stdout.write(
    [
      "Usage: tsx --env-file=env/.env scripts/redis-cleanup.ts [--execute]",
      "",
      "Without --execute, the script runs in dry-run mode.",
      "Legacy patterns:",
      ...LEGACY_PATTERNS.map((pattern) => `  - ${pattern}`),
      "",
    ].join("\n")
  );
}

async function scanKeys(redis: ReturnType<typeof getRedisClient>, pattern: string) {
  const matchedKeys: string[] = [];
  let cursor = "0";

  do {
    const [nextCursor, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", "200");
    cursor = nextCursor;
    matchedKeys.push(...keys);
  } while (cursor !== "0");

  return matchedKeys;
}

async function main() {
  if (shouldHelp) {
    printHelp();
    return;
  }

  const redis = getRedisClient();

  try {
    const uniqueKeys = new Set<string>();
    for (const pattern of LEGACY_PATTERNS) {
      const keys = await scanKeys(redis, pattern);
      for (const key of keys) {
        uniqueKeys.add(key);
      }
    }

    const keys = Array.from(uniqueKeys).sort();
    process.stdout.write(
      [
        shouldExecute ? "Redis legacy cleanup: execute mode" : "Redis legacy cleanup: dry-run mode",
        `Matched keys: ${keys.length}`,
        ...keys.map((key) => `  ${key}`),
        "",
      ].join("\n")
    );

    if (shouldExecute && keys.length > 0) {
      await redis.del(...keys);
      process.stdout.write(`Deleted keys: ${keys.length}\n`);
    }
  } finally {
    await closeRedisClient();
  }
}

main().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`
  );
  process.exitCode = 1;
});
