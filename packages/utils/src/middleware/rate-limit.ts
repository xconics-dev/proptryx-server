import { UnstorageStore, rateLimiter } from "hono-rate-limiter";
import type { Context, MiddlewareHandler } from "hono";
import { resolveClientIpFromHeaderGetter } from "../functions/network";
import { getRatelimiterRedisStorage } from "../redis";

export type RateLimitProfile = "global" | "transactional" | "operational";
export type RateLimitKeyScope = "client" | "client-method" | "client-route";

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
  skipMethods?: string[];
  keyScope?: RateLimitKeyScope;
}

const DEFAULT_RATE_LIMIT_SKIP_METHODS = ["OPTIONS"];
const LARGE_NUMERIC_SEGMENT_PATTERN = /^\d{4,}$/;
const UUID_LIKE_SEGMENT_PATTERN = /^[0-9a-f]{8}-[0-9a-f-]{13,}$/i;
const LIKELY_IDENTIFIER_SEGMENT_PATTERN = /^[a-z0-9_-]{16,}$/i;

const rateLimiterStoreByPrefix = new Map<string, UnstorageStore>();

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
    maxRequests: 200,
    windowMs: 60_000,
    message: "Too many operational requests. Please retry shortly.",
  },
};

function normalizeMethod(method: string) {
  return method.trim().toUpperCase();
}

function getClientIdentifier(c: Context): string {
  const clientIp = resolveClientIpFromHeaderGetter((headerName) => c.req.header(headerName));
  if (clientIp) {
    return clientIp;
  }

  const host = c.req.header("host")?.split(":")[0]?.trim().toLowerCase();
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") {
    return "127.0.0.1";
  }

  return "anonymous-client";
}

function normalizeRateLimitPathSegment(segment: string) {
  const normalizedSegment = segment.trim().toLowerCase();
  if (!normalizedSegment) {
    return "";
  }

  if (
    normalizedSegment.length > 48 ||
    LARGE_NUMERIC_SEGMENT_PATTERN.test(normalizedSegment) ||
    UUID_LIKE_SEGMENT_PATTERN.test(normalizedSegment) ||
    LIKELY_IDENTIFIER_SEGMENT_PATTERN.test(normalizedSegment)
  ) {
    return ":id";
  }

  return normalizedSegment;
}

function normalizeRateLimitPath(path: string) {
  const normalizedPath = path.trim().replace(/^\/+/, "");
  if (!normalizedPath) {
    return "root";
  }

  const normalizedSegments = normalizedPath
    .split("/")
    .map(normalizeRateLimitPathSegment)
    .filter((segment) => segment.length > 0);

  if (normalizedSegments.length === 0) {
    return "root";
  }

  return normalizedSegments.join("_");
}

function normalizeSkipPath(path: string) {
  const normalizedPath = path.trim();
  if (!normalizedPath) {
    return "";
  }

  if (normalizedPath === "/") {
    return "/";
  }

  return normalizedPath.replace(/\/+$/, "");
}

function createSkipPathMatcher(skipPaths: string[]) {
  const normalizedSkipPaths = skipPaths.map(normalizeSkipPath).filter((path) => path.length > 0);

  if (normalizedSkipPaths.length === 0) {
    return () => false;
  }

  return (path: string) => {
    for (const skipPath of normalizedSkipPaths) {
      if (skipPath === "/") {
        if (path === "/") {
          return true;
        }
        continue;
      }

      if (path === skipPath || path.startsWith(`${skipPath}/`)) {
        return true;
      }
    }

    return false;
  };
}

function shouldSkipMethod(method: string, skipMethods: Set<string>) {
  return skipMethods.has(normalizeMethod(method));
}

function buildRateLimitKey(c: Context, keyScope: RateLimitKeyScope) {
  const clientIdentifier = getClientIdentifier(c);
  if (keyScope === "client") {
    return clientIdentifier;
  }

  const method = normalizeMethod(c.req.method);
  if (keyScope === "client-method") {
    return `${clientIdentifier}:${method}`;
  }

  return `${clientIdentifier}:${method}:${normalizeRateLimitPath(c.req.path)}`;
}

function resolveDefaultKeyScope(profile: RateLimitProfile): RateLimitKeyScope {
  if (profile === "global") {
    return "client";
  }

  if (profile === "transactional") {
    return "client-route";
  }

  return "client-method";
}

function getRateLimiterStore(keyPrefix: string) {
  const cachedStore = rateLimiterStoreByPrefix.get(keyPrefix);
  if (cachedStore) {
    return cachedStore;
  }

  const store = new UnstorageStore({
    storage: getRatelimiterRedisStorage(),
    prefix: `${keyPrefix}:`,
  });
  rateLimiterStoreByPrefix.set(keyPrefix, store);

  return store;
}

export function createRateLimit(options: CreateRateLimitOptions): MiddlewareHandler {
  const preset = RATE_LIMIT_PRESETS[options.profile];
  const keyPrefix = options.keyPrefix ?? preset.keyPrefix;
  const maxRequests = options.maxRequests ?? preset.maxRequests;
  const windowMs = options.windowMs ?? preset.windowMs;
  const message = options.message ?? preset.message;
  const skipMethods = new Set(
    (options.skipMethods ?? DEFAULT_RATE_LIMIT_SKIP_METHODS).map(normalizeMethod)
  );
  const shouldSkipPathRequest = createSkipPathMatcher(options.skipPaths ?? []);
  const keyScope = options.keyScope ?? resolveDefaultKeyScope(options.profile);

  return rateLimiter({
    windowMs,
    limit: maxRequests,
    standardHeaders: "draft-6",
    store: getRateLimiterStore(keyPrefix),
    keyGenerator: (c) => buildRateLimitKey(c, keyScope),
    skip: (c) => shouldSkipMethod(c.req.method, skipMethods) || shouldSkipPathRequest(c.req.path),
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
