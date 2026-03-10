import { getDB } from "@proptryx/database";
import { AUTH_SESSION_REDIS_PREFIX, getRedisClient, initializeRedisClient } from "@proptryx/utils";
import { redisStorage } from "@better-auth/redis-storage";
import { env } from "@/config/env";

export function getBetterAuthConfigState() {
  const betterAuthUrl = new URL(env.BETTER_AUTH_URL);
  const trustedOrigins = Array.from(new Set([...env.CORS_ALLOWED_ORIGINS, betterAuthUrl.origin]));

  return {
    betterAuthSecret: env.BETTER_AUTH_SECRET,
    betterAuthUrl,
    isProduction: env.NODE_ENV === "production",
    trustedOrigins,
  };
}

export function normalizeBasePath(pathname: string) {
  const normalizedPathname = pathname.trim().replace(/\/+$/, "");
  return normalizedPathname.length === 0 ? "/" : normalizedPathname;
}

export function resolveAuthDatabase() {
  try {
    return getDB();
  } catch {
    // Better Auth CLI imports this file before service boot; it only needs config shape.
    return {} as never;
  }
}

export function resolveAuthSecondaryStorage() {
  return redisStorage({
    client: getRedisClient(),
    keyPrefix: AUTH_SESSION_REDIS_PREFIX,
  });
}

export async function initializeAuthSecondaryStorage() {
  await initializeRedisClient();
}
