import { getDB, region, zone } from "@proptryx/database";
import { AUTH_SESSION_REDIS_PREFIX, getRedisClient, initializeRedisClient } from "@proptryx/utils";
import { redisStorage } from "@better-auth/redis-storage";
import { env } from "@/config/env";
import { eq } from "drizzle-orm";
import { type OrgFields, orgFields } from "./fields/org";

function getTrustedOriginHosts(origins: string[]) {
  return Array.from(
    new Set(
      origins.flatMap((origin) => {
        try {
          return [new URL(origin).host];
        } catch {
          return [];
        }
      })
    )
  );
}

export function getBetterAuthConfigState() {
  const betterAuthUrl = new URL(env.BETTER_AUTH_URL);
  const trustedOrigins = Array.from(new Set([...env.CORS_ALLOWED_ORIGINS, betterAuthUrl.origin]));
  const isProduction = env.NODE_ENV === "production";
  const crossSubDomainCookiesEnabled = isProduction && env.BETTER_AUTH_CROSS_SUBDOMAIN_COOKIES;

  if (crossSubDomainCookiesEnabled && !env.BETTER_AUTH_COOKIE_DOMAIN) {
    throw new Error(
      "BETTER_AUTH_COOKIE_DOMAIN is required when BETTER_AUTH_CROSS_SUBDOMAIN_COOKIES=true"
    );
  }

  return {
    betterAuthSecret: env.BETTER_AUTH_SECRET,
    betterAuthUrl,
    betterAuthAllowedHosts: getTrustedOriginHosts(trustedOrigins),
    crossSubDomainCookies: crossSubDomainCookiesEnabled
      ? {
          enabled: true,
          domain: env.BETTER_AUTH_COOKIE_DOMAIN,
        }
      : undefined,
    isProduction,
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

export async function resolveUserZone(zoneId?: string | null) {
  if (!zoneId) {
    return {
      region: null,
      zone: null,
    };
  }

  const [location] = await getDB()
    .select({
      regionId: region.id,
      regionName: region.name,
      zoneId: zone.id,
      zoneName: zone.name,
    })
    .from(zone)
    .leftJoin(region, eq(zone.regionId, region.id))
    .where(eq(zone.id, zoneId))
    .limit(1);

  if (!location) {
    return {
      region: null,
      zone: null,
    };
  }

  return {
    zone: {
      id: location.zoneId,
      name: location.zoneName,
    },
    region: location.regionId
      ? {
          id: location.regionId,
          name: location.regionName,
        }
      : null,
  };
}

export const organizationAdditionalFields = Array.isArray(orgFields)
  ? Object.fromEntries(
      orgFields.map((field: OrgFields) => [
        field.name,
        {
          type: field.type,
          input: field.input,
          required: field.required,
          defaultValue: field.defaultValue,
        },
      ])
    )
  : orgFields;

// Add to utils.ts
export function resolveEmailExistsCache() {
  const redis = getRedisClient();
  const PREFIX = "auth:email-exists:";
  return {
    get: (email: string) => redis.get(`${PREFIX}${email}`),
    set: (email: string, value: "1" | "0") => redis.set(`${PREFIX}${email}`, value, "EX", 60),
  };
}
