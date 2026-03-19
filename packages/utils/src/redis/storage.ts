import { createStorage } from "unstorage";
import redisDriver from "unstorage/drivers/redis";
import { env } from "../env";
import { getRedisClient } from "./client";
import { RATE_LIMIT_REDIS_NAMESPACE } from "./namespaces";

let redisStorage: ReturnType<typeof createStorage> | null = null;
let cleanupPromise: Promise<void> | null = null;

const LEGACY_RATE_LIMIT_PATTERNS = [
  `${RATE_LIMIT_REDIS_NAMESPACE}:*|*|*`,
  `${RATE_LIMIT_REDIS_NAMESPACE}:*:unknown:*`,
  `${RATE_LIMIT_REDIS_NAMESPACE}:*:127.0.0.1:*`,
  `${RATE_LIMIT_REDIS_NAMESPACE}:*:localhost:*`,
];

const LEGACY_CLEANUP_LOCK_KEY = `${RATE_LIMIT_REDIS_NAMESPACE}:maintenance:legacy-cleanup-lock`;
const LEGACY_CLEANUP_LOCK_TTL_SECONDS = 6 * 60 * 60;
const LEGACY_CLEANUP_SCAN_COUNT = 200;
const LEGACY_CLEANUP_BATCH_SIZE = 250;
const LEGACY_CLEANUP_MAX_KEYS = 20_000;

async function deleteKeys(keys: string[]) {
  if (keys.length === 0) {
    return;
  }

  const redis = getRedisClient();
  try {
    await redis.unlink(...keys);
  } catch {
    await redis.del(...keys);
  }
}

async function cleanupLegacyRateLimitKeys() {
  const redis = getRedisClient();
  const lock = await redis.set(
    LEGACY_CLEANUP_LOCK_KEY,
    `${Date.now()}`,
    "EX",
    LEGACY_CLEANUP_LOCK_TTL_SECONDS,
    "NX"
  );

  if (lock !== "OK") {
    return;
  }

  const keysToDelete = new Set<string>();

  for (const pattern of LEGACY_RATE_LIMIT_PATTERNS) {
    let cursor = "0";

    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        `${LEGACY_CLEANUP_SCAN_COUNT}`
      );
      cursor = nextCursor;

      for (const key of keys) {
        if (keysToDelete.size >= LEGACY_CLEANUP_MAX_KEYS) {
          break;
        }
        keysToDelete.add(key);
      }

      if (keysToDelete.size >= LEGACY_CLEANUP_MAX_KEYS) {
        break;
      }
    } while (cursor !== "0");

    if (keysToDelete.size >= LEGACY_CLEANUP_MAX_KEYS) {
      break;
    }
  }

  if (keysToDelete.size === 0) {
    return;
  }

  const allKeys = Array.from(keysToDelete);
  for (let i = 0; i < allKeys.length; i += LEGACY_CLEANUP_BATCH_SIZE) {
    await deleteKeys(allKeys.slice(i, i + LEGACY_CLEANUP_BATCH_SIZE));
  }
}

function scheduleLegacyRateLimitCleanup() {
  if (cleanupPromise) {
    return;
  }

  cleanupPromise = cleanupLegacyRateLimitKeys()
    .catch((error) => {
      console.warn("rate limiter legacy cleanup failed", error);
    })
    .finally(() => {
      cleanupPromise = null;
    });
}

export function getRatelimiterRedisStorage() {
  if (redisStorage) {
    return redisStorage;
  }

  redisStorage = createStorage({
    driver: redisDriver({
      url: env.REDIS_URL,
      base: RATE_LIMIT_REDIS_NAMESPACE,
      preConnect: true,
    }),
  });

  void scheduleLegacyRateLimitCleanup();

  return redisStorage;
}
