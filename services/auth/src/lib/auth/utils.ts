import { getDB, region, type DB, zone } from "@proptryx/database";
import { AUTH_SESSION_REDIS_PREFIX, getRedisClient, initializeRedisClient } from "@proptryx/utils";
import { redisStorage } from "@better-auth/redis-storage";
import { env } from "@/config/env";
import { eq } from "drizzle-orm";
import { type OrgFields, orgFields } from "./fields/org";

const AUTH_USER_STATUS_REDIS_PREFIX = "proptryx-auth-user-status:";
const AUTH_USER_STATUS_REDIS_TTL_SECONDS = 1;

export type CachedAuthUserStatus = {
  id: string;
  banned: boolean;
  banReason: string | null;
  role: string | null;
  panel: string | null;
  zoneId: string | null;
  twoFactorEnabled: boolean;
  updatedAt: string;
};

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

function getHostname(value: string) {
  return value.split(":")[0]?.toLowerCase() ?? value.toLowerCase();
}

function getSiteDomain(host: string) {
  const hostname = getHostname(host);

  if (hostname === "localhost" || /^[\d.]+$/.test(hostname)) {
    return hostname;
  }

  const parts = hostname.split(".").filter(Boolean);

  return parts.length <= 2 ? hostname : parts.slice(-2).join(".");
}

function matchesCookieDomain(host: string, domain: string) {
  const hostname = getHostname(host);
  return hostname === domain || hostname.endsWith(`.${domain}`);
}

export function getBetterAuthConfigState() {
  const betterAuthUrl = new URL(env.BETTER_AUTH_URL);
  const trustedOrigins = Array.from(new Set([...env.CORS_ALLOWED_ORIGINS, betterAuthUrl.origin]));
  const isProduction = env.NODE_ENV === "production";
  const crossSubDomainCookiesEnabled = isProduction && env.BETTER_AUTH_CROSS_SUBDOMAIN_COOKIES;
  const cookieDomain = env.BETTER_AUTH_COOKIE_DOMAIN;
  const authHost = betterAuthUrl.host;
  const trustedOriginSites = Array.from(
    new Set(getTrustedOriginHosts(trustedOrigins).map((host) => getSiteDomain(host)))
  );
  const hasCrossSiteTrustedOrigins =
    isProduction &&
    trustedOriginSites.some((siteDomain) => siteDomain !== getSiteDomain(betterAuthUrl.host));
  const cookieSameSite =
    env.BETTER_AUTH_COOKIE_SAME_SITE ?? (hasCrossSiteTrustedOrigins ? "none" : "lax");

  if (crossSubDomainCookiesEnabled && !cookieDomain) {
    throw new Error(
      "BETTER_AUTH_COOKIE_DOMAIN is required when BETTER_AUTH_CROSS_SUBDOMAIN_COOKIES=true"
    );
  }

  if (crossSubDomainCookiesEnabled && cookieDomain) {
    if (!matchesCookieDomain(authHost, cookieDomain)) {
      throw new Error(
        `BETTER_AUTH_COOKIE_DOMAIN=${cookieDomain} must match BETTER_AUTH_URL host ${authHost}. For mixed domains such as proptryx.app and proptryx.com, keep BETTER_AUTH_COOKIE_DOMAIN on the auth server parent domain and use SameSite=None cookies.`
      );
    }
  }

  return {
    betterAuthSecret: env.BETTER_AUTH_SECRET,
    betterAuthUrl,
    betterAuthAllowedHosts: getTrustedOriginHosts(trustedOrigins),
    crossSubDomainCookies: crossSubDomainCookiesEnabled
      ? {
          enabled: true,
          domain: cookieDomain,
        }
      : undefined,
    cookieSameSite,
    isProduction,
    trustedOrigins,
  };
}

export function normalizeBasePath(pathname: string) {
  const normalizedPathname = pathname.trim().replace(/\/+$/, "");
  return normalizedPathname.length === 0 ? "/" : normalizedPathname;
}

export function resolveAuthDatabase(): DB {
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

export function resolveAuthUserStatusCache() {
  const redis = getRedisClient();

  return {
    async get(userId: string): Promise<CachedAuthUserStatus | null> {
      const raw = await redis.get(`${AUTH_USER_STATUS_REDIS_PREFIX}${userId}`);
      if (!raw) {
        return null;
      }

      try {
        return JSON.parse(raw) as CachedAuthUserStatus;
      } catch {
        await redis.del(`${AUTH_USER_STATUS_REDIS_PREFIX}${userId}`);
        return null;
      }
    },
    set(userId: string, value: CachedAuthUserStatus) {
      return redis.set(
        `${AUTH_USER_STATUS_REDIS_PREFIX}${userId}`,
        JSON.stringify(value),
        "EX",
        AUTH_USER_STATUS_REDIS_TTL_SECONDS
      );
    },
    del(userId: string) {
      return redis.del(`${AUTH_USER_STATUS_REDIS_PREFIX}${userId}`);
    },
  };
}
