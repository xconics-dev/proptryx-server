import { UnstorageStore, rateLimiter } from "hono-rate-limiter";
import type { Context, MiddlewareHandler } from "hono";
import { getRatelimiterRedisStorage } from "../redis";

export type RateLimitProfile = "global" | "transactional" | "operational";

export interface RateLimitDefinition {
  keyPrefix: string;
  maxRequests: number;
  windowMs: number;
  message: string;
}

export interface CreateRateLimitOptions {
  profile: RateLimitProfile;
  keyPrefix?: string;
  maxRequests?: number;
  windowMs?: number;
  message?: string;
  skipPaths?: string[];
}

export const RATE_LIMIT_PRESETS: Record<RateLimitProfile, RateLimitDefinition> = {
  global: {
    keyPrefix: "global",
    maxRequests: 120,
    windowMs: 60_000,
    message: "Too many requests. Please retry shortly.",
  },
  transactional: {
    keyPrefix: "transactional",
    maxRequests: 20,
    windowMs: 60_000,
    message: "Too many transactional requests. Please retry shortly.",
  },
  operational: {
    keyPrefix: "operational",
    maxRequests: 300,
    windowMs: 60_000,
    message: "Too many operational requests. Please retry shortly.",
  },
};

function getClientIdentifier(c: Context): string {
  const forwardedFor = c.req.header("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = c.req.header("x-real-ip")?.trim();
  const cfIp = c.req.header("cf-connecting-ip")?.trim();

  if (forwardedFor || realIp || cfIp) {
    return forwardedFor || realIp || cfIp || "unknown";
  }

  const host = c.req.header("host")?.split(":")[0]?.trim().toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return "127.0.0.1";
  }

  return "anonymous-client";
}

function normalizeRateLimitPath(path: string) {
  const normalizedPath = path.trim().replace(/^\/+/, "");
  if (!normalizedPath) {
    return "root";
  }

  return normalizedPath.replaceAll("/", "_");
}

function shouldSkipPath(path: string, skipPaths: string[]) {
  return skipPaths.some((skipPath) => path === skipPath || path.startsWith(`${skipPath}/`));
}

export function createRateLimit(options: CreateRateLimitOptions): MiddlewareHandler {
  const preset = RATE_LIMIT_PRESETS[options.profile];
  const keyPrefix = options.keyPrefix ?? preset.keyPrefix;
  const maxRequests = options.maxRequests ?? preset.maxRequests;
  const windowMs = options.windowMs ?? preset.windowMs;
  const message = options.message ?? preset.message;
  const skipPaths = options.skipPaths ?? [];

  return rateLimiter({
    windowMs,
    limit: maxRequests,
    standardHeaders: "draft-6",
    store: new UnstorageStore({
      storage: getRatelimiterRedisStorage(),
      prefix: `${keyPrefix}:`,
    }),
    keyGenerator: (c) =>
      `${getClientIdentifier(c)}|${c.req.method}|${normalizeRateLimitPath(c.req.path)}`,
    skip: (c) => shouldSkipPath(c.req.path, skipPaths),
    message: {
      success: false,
      error: "Too Many Requests",
      message,
      profile: options.profile,
    },
  });
}

export function createGlobalRateLimit(options: Omit<CreateRateLimitOptions, "profile"> = {}) {
  return createRateLimit({ ...options, profile: "global" });
}

export function createTransactionalRateLimit(
  options: Omit<CreateRateLimitOptions, "profile"> = {}
) {
  return createRateLimit({ ...options, profile: "transactional" });
}

export function createOperationalRateLimit(options: Omit<CreateRateLimitOptions, "profile"> = {}) {
  return createRateLimit({ ...options, profile: "operational" });
}
