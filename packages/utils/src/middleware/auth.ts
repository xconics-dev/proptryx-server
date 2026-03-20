import { createHash } from "node:crypto";
import {
  getDB,
  member,
  organization as authOrganizationTable,
  type session as authSessionTable,
  type user as authUserTable,
} from "@proptryx/database";
import { and, eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import type { Context, ContextVariableMap, MiddlewareHandler } from "hono";
import { env } from "../env";
import { AUTH_SESSION_FORWARD_HEADERS } from "../functions/network";
import { AUTH_MIDDLEWARE_REDIS_NAMESPACE, getRedisClient } from "../redis";

export const AUTH_CONTEXT_KEY = "auth" as const;

export type BetterAuthDbUserRecord = InferSelectModel<typeof authUserTable>;
export type BetterAuthDbSessionRecord = InferSelectModel<typeof authSessionTable>;
export type BetterAuthDbOrganizationRecord = InferSelectModel<typeof authOrganizationTable>;

export type BetterAuthSessionRecord = BetterAuthDbSessionRecord & Record<string, unknown>;
export type BetterAuthUserRecord = BetterAuthDbUserRecord & Record<string, unknown>;
export type BetterAuthOrganizationRecord = BetterAuthDbOrganizationRecord & Record<string, unknown>;

export interface BetterAuthSessionPayload<
  TUser extends BetterAuthUserRecord = BetterAuthUserRecord,
  TSession extends BetterAuthSessionRecord = BetterAuthSessionRecord,
> {
  user: TUser;
  session: TSession;
}

export interface BetterAuthContextEntityOptions {
  data?: boolean;
  user?: boolean;
  session?: boolean;
  organization?: boolean;
  hasOrganization?: boolean;
}

export type BetterAuthRequiredEntity = "user" | "session" | "organization";

interface ResolvedAuthContextEntityOptions {
  data: boolean;
  user: boolean;
  session: boolean;
  organization: boolean;
  hasOrganization: boolean;
}

export interface BetterAuthContextValue<
  TPayload extends BetterAuthSessionPayload = BetterAuthSessionPayload,
> {
  isAuthenticated: boolean;
  data: TPayload | null;
  user: TPayload["user"] | null;
  session: TPayload["session"] | null;
  organization: BetterAuthOrganizationRecord | null;
  hasOrganization: boolean;
}

export type BetterAuthVariables<
  TPayload extends BetterAuthSessionPayload = BetterAuthSessionPayload,
> = ContextVariableMap & {
  auth: BetterAuthContextValue<TPayload>;
};

export interface CreateBetterAuthSessionMiddlewareOptions {
  authServiceUrl?: string;
  sessionEndpointPath?: string;
  required?: boolean;
  requiredEntities?: BetterAuthRequiredEntity[];
  timeoutMs?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
  retryOnStatuses?: number[];
  unavailableFailCacheTtlMs?: number;
  unavailableFailureThreshold?: number;
  skipPaths?: string[];
  fetchImplementation?: typeof fetch;
  cacheTtlMs?: number;
  cacheMaxEntries?: number;
  enableRedisCache?: boolean;
  redisCacheTtlSeconds?: number;
  entities?: BetterAuthContextEntityOptions;
}

type SerializableAuthContext = BetterAuthContextValue<BetterAuthSessionPayload>;

type AuthSessionCacheRecord = {
  expiresAt: number;
  context: SerializableAuthContext;
};

type OrganizationResolution = {
  organization: BetterAuthOrganizationRecord | null;
  hasOrganization: boolean;
};

type AuthSessionFetchOutcome =
  | { type: "success"; payload: BetterAuthSessionPayload }
  | { type: "unauthorized" }
  | { type: "unavailable" };

type AuthContextResolutionOutcome =
  | { unavailable: true }
  | { unavailable: false; context: SerializableAuthContext };

const DEFAULT_SESSION_ENDPOINT_PATH = "/api/auth/get-session";
const DEFAULT_TIMEOUT_MS = 1_500;
const DEFAULT_RETRY_ATTEMPTS = 1;
const DEFAULT_RETRY_DELAY_MS = 100;
const DEFAULT_UNAVAILABLE_FAIL_CACHE_TTL_MS = 1_500;
const DEFAULT_UNAVAILABLE_FAILURE_THRESHOLD = 2;
const DEFAULT_RETRYABLE_STATUS_CODES = [408, 425, 429, 500, 502, 503, 504] as const;
const DEFAULT_SKIP_PATHS = ["/health", "/favicon.ico", "/favicon.png"];
const DEFAULT_CACHE_TTL_MS = 3_000;
const DEFAULT_CACHE_MAX_ENTRIES = 2_000;

const authSessionCache = new Map<string, AuthSessionCacheRecord>();
const authContextResolutionInFlight = new Map<string, Promise<AuthContextResolutionOutcome>>();

type AuthUpstreamCircuitState = {
  consecutiveFailures: number;
  unavailableUntilMs: number;
};

const authUpstreamCircuitByEndpoint = new Map<string, AuthUpstreamCircuitState>();

function normalizeRequiredEntities(requiredEntities: BetterAuthRequiredEntity[] | undefined) {
  if (!requiredEntities || requiredEntities.length === 0) {
    return [] as BetterAuthRequiredEntity[];
  }

  const uniqueRequiredEntities = new Set<BetterAuthRequiredEntity>();

  for (const requiredEntity of requiredEntities) {
    if (
      requiredEntity === "user" ||
      requiredEntity === "session" ||
      requiredEntity === "organization"
    ) {
      uniqueRequiredEntities.add(requiredEntity);
    }
  }

  return Array.from(uniqueRequiredEntities);
}

function resolveEntityOptions(
  options: BetterAuthContextEntityOptions | undefined,
  requiredEntities: BetterAuthRequiredEntity[]
): ResolvedAuthContextEntityOptions {
  const requiredEntitySet = new Set(requiredEntities);

  return {
    data: options?.data ?? true,
    user: requiredEntitySet.has("user") ? true : (options?.user ?? true),
    session: requiredEntitySet.has("session") ? true : (options?.session ?? true),
    organization: requiredEntitySet.has("organization") ? true : (options?.organization ?? false),
    hasOrganization: options?.hasOrganization ?? true,
  };
}

function buildEntityScopeKey(options: ResolvedAuthContextEntityOptions) {
  return [
    options.data ? "d1" : "d0",
    options.user ? "u1" : "u0",
    options.session ? "s1" : "s0",
    options.organization ? "o1" : "o0",
    options.hasOrganization ? "h1" : "h0",
  ].join("|");
}

function createUnauthenticatedContext<
  TPayload extends BetterAuthSessionPayload = BetterAuthSessionPayload,
>(): BetterAuthContextValue<TPayload> {
  return {
    isAuthenticated: false,
    data: null,
    user: null,
    session: null,
    organization: null,
    hasOrganization: false,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function looksLikeSessionPayload(value: unknown): value is BetterAuthSessionPayload {
  if (!isObject(value)) {
    return false;
  }

  return isObject(value.user) && isObject(value.session);
}

function isAuthContextLike(value: unknown): value is SerializableAuthContext {
  if (!isObject(value)) {
    return false;
  }

  return typeof value.isAuthenticated === "boolean";
}

function normalizeSessionPayload(payload: unknown): BetterAuthSessionPayload | null {
  if (looksLikeSessionPayload(payload)) {
    return payload;
  }

  if (!isObject(payload)) {
    return null;
  }

  const data = payload.data;
  if (looksLikeSessionPayload(data)) {
    return data;
  }

  return null;
}

function normalizePath(value: string) {
  const normalized = value.trim();
  if (normalized === "") {
    return "/";
  }

  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}

function normalizeId(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function resolveSessionEndpointUrl(options: CreateBetterAuthSessionMiddlewareOptions) {
  const resolvedAuthServiceUrl = options.authServiceUrl ?? env.AUTH_SERVICE_URL;

  if (!resolvedAuthServiceUrl) {
    throw new Error(
      "AUTH_SERVICE_URL is required. Set it in environment or pass authServiceUrl to createBetterAuthSessionMiddleware()."
    );
  }

  const baseUrl = resolvedAuthServiceUrl.trim().replace(/\/+$/, "");
  const path = normalizePath(options.sessionEndpointPath ?? DEFAULT_SESSION_ENDPOINT_PATH);

  return `${baseUrl}${path}`;
}

function shouldSkipPath(path: string, skipPaths: string[]) {
  return skipPaths.some((skipPath) => path === skipPath || path.startsWith(`${skipPath}/`));
}

function readAuthIdentity(headers: Headers) {
  const authorization = headers.get("authorization")?.trim();
  if (authorization) {
    return `auth:${authorization}`;
  }

  const cookie = headers.get("cookie")?.trim();
  if (cookie) {
    return `cookie:${cookie}`;
  }

  return null;
}

function hasAuthSignal(headers: Headers) {
  return Boolean(readAuthIdentity(headers));
}

function hashIdentity(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function createAuthCacheKey(headers: Headers, sessionEndpointUrl: string, entityScopeKey: string) {
  const identity = readAuthIdentity(headers);
  if (!identity) {
    return null;
  }

  return `${AUTH_MIDDLEWARE_REDIS_NAMESPACE}:${hashIdentity(`${sessionEndpointUrl}|${entityScopeKey}|${identity}`)}`;
}

function buildForwardedHeaders(sourceHeaders: Headers) {
  const headers = new Headers();

  for (const headerName of AUTH_SESSION_FORWARD_HEADERS) {
    const value = sourceHeaders.get(headerName);
    if (value) {
      headers.set(headerName, value);
    }
  }

  headers.set("accept", "application/json");

  return headers;
}

function setAuthContext<TPayload extends BetterAuthSessionPayload = BetterAuthSessionPayload>(
  c: Context,
  value: BetterAuthContextValue<TPayload>
) {
  c.set(AUTH_CONTEXT_KEY, value as never);
}

function getCachedAuthContext<TPayload extends BetterAuthSessionPayload = BetterAuthSessionPayload>(
  c: Context
) {
  return c.get(AUTH_CONTEXT_KEY) as BetterAuthContextValue<TPayload> | undefined;
}

function unauthorizedResponse(c: Context) {
  return c.json(
    {
      success: false,
      error: "Unauthorized",
      message: "Active session not found",
    },
    401
  );
}

function authServiceUnavailableResponse(c: Context) {
  return c.json(
    {
      success: false,
      error: "Service Unavailable",
      message: "Unable to verify session at this time",
    },
    503
  );
}

function requiredEntityUnauthorizedResponse(c: Context, requiredEntity: BetterAuthRequiredEntity) {
  const requiredEntityLabels: Record<BetterAuthRequiredEntity, string> = {
    user: "Required user access",
    session: "Required session access",
    organization: "Required organization access",
  };

  return c.json(
    {
      success: false,
      error: "Unauthorized",
      message: requiredEntityLabels[requiredEntity],
      requiredEntity,
    },
    401
  );
}

function findMissingRequiredEntity(
  context: BetterAuthContextValue,
  requiredEntities: BetterAuthRequiredEntity[]
) {
  for (const requiredEntity of requiredEntities) {
    if (requiredEntity === "user" && !context.user) {
      return requiredEntity;
    }

    if (requiredEntity === "session" && !context.session) {
      return requiredEntity;
    }

    if (requiredEntity === "organization" && !context.organization) {
      return requiredEntity;
    }
  }

  return null;
}

function ensureRequiredAccess(
  c: Context,
  context: BetterAuthContextValue,
  required: boolean,
  requiredEntities: BetterAuthRequiredEntity[]
) {
  if (required && !context.isAuthenticated) {
    return unauthorizedResponse(c);
  }

  const missingRequiredEntity = findMissingRequiredEntity(context, requiredEntities);
  if (missingRequiredEntity) {
    return requiredEntityUnauthorizedResponse(c, missingRequiredEntity);
  }

  return null;
}

function pruneMemoryCache(maxEntries: number) {
  if (authSessionCache.size <= maxEntries) {
    return;
  }

  const overflow = authSessionCache.size - maxEntries;
  const keyIterator = authSessionCache.keys();

  for (let index = 0; index < overflow; index += 1) {
    const next = keyIterator.next();
    if (next.done) {
      return;
    }

    authSessionCache.delete(next.value);
  }
}

function getCachedAuthContextFromMemory<
  TPayload extends BetterAuthSessionPayload = BetterAuthSessionPayload,
>(cacheKey: string): BetterAuthContextValue<TPayload> | null {
  const cached = authSessionCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    authSessionCache.delete(cacheKey);
    return null;
  }

  return cached.context as BetterAuthContextValue<TPayload>;
}

function setCachedAuthContextInMemory(
  cacheKey: string,
  context: SerializableAuthContext,
  ttlMs: number,
  maxEntries: number
) {
  if (ttlMs <= 0) {
    return;
  }

  authSessionCache.set(cacheKey, {
    context,
    expiresAt: Date.now() + ttlMs,
  });
  pruneMemoryCache(maxEntries);
}

function getReadyRedisClient() {
  try {
    const client = getRedisClient();
    return client.status === "ready" ? client : null;
  } catch {
    return null;
  }
}

async function readCachedAuthContextFromRedis<
  TPayload extends BetterAuthSessionPayload = BetterAuthSessionPayload,
>(cacheKey: string): Promise<BetterAuthContextValue<TPayload> | null> {
  const client = getReadyRedisClient();
  if (!client) {
    return null;
  }

  try {
    const raw = await client.get(cacheKey);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as {
      expiresAt?: number;
      context?: unknown;
    };

    if (typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Date.now()) {
      void client.del(cacheKey);
      return null;
    }

    if (!isAuthContextLike(parsed.context)) {
      void client.del(cacheKey);
      return null;
    }

    return parsed.context as BetterAuthContextValue<TPayload>;
  } catch {
    return null;
  }
}

async function setCachedAuthContextInRedis(
  cacheKey: string,
  context: SerializableAuthContext,
  ttlMs: number,
  redisCacheTtlSeconds?: number
) {
  const client = getReadyRedisClient();
  if (!client || ttlMs <= 0) {
    return;
  }

  const ttlSeconds = Math.max(1, redisCacheTtlSeconds ?? Math.ceil(ttlMs / 1_000));

  try {
    await client.set(
      cacheKey,
      JSON.stringify({
        context,
        expiresAt: Date.now() + ttlSeconds * 1_000,
      }),
      "EX",
      ttlSeconds
    );
  } catch {
    // Ignore Redis cache write errors to avoid impacting request flow.
  }
}

function sleep(delayMs: number) {
  if (delayMs <= 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function fetchAuthSessionPayloadWithRetry(options: {
  fetchImplementation: typeof fetch;
  sessionEndpointUrl: string;
  requestHeaders: Headers;
  timeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  retryOnStatuses: Set<number>;
}): Promise<AuthSessionFetchOutcome> {
  const maxAttempts = Math.max(1, options.retryAttempts + 1);

  for (let attemptIndex = 0; attemptIndex < maxAttempts; attemptIndex += 1) {
    const isLastAttempt = attemptIndex === maxAttempts - 1;
    const attemptTimeoutMs =
      attemptIndex === 0 ? options.timeoutMs : Math.max(options.timeoutMs + 750, options.timeoutMs);

    try {
      const response = await options.fetchImplementation(options.sessionEndpointUrl, {
        method: "GET",
        headers: options.requestHeaders,
        signal: AbortSignal.timeout(attemptTimeoutMs),
      });

      if (response.status === 401 || response.status === 403) {
        return { type: "unauthorized" };
      }

      if (!response.ok) {
        if (!isLastAttempt && options.retryOnStatuses.has(response.status)) {
          await sleep(options.retryDelayMs * (attemptIndex + 1));
          continue;
        }

        return { type: "unavailable" };
      }

      const payload = normalizeSessionPayload(await response.json());
      if (!payload) {
        return { type: "unauthorized" };
      }

      return {
        type: "success",
        payload,
      };
    } catch {
      if (!isLastAttempt) {
        await sleep(options.retryDelayMs * (attemptIndex + 1));
        continue;
      }

      return { type: "unavailable" };
    }
  }

  return { type: "unavailable" };
}

function getOrCreateAuthContextResolution(
  cacheKey: string,
  resolver: () => Promise<AuthContextResolutionOutcome>
) {
  const inFlightResolution = authContextResolutionInFlight.get(cacheKey);
  if (inFlightResolution) {
    return inFlightResolution;
  }

  const resolutionPromise = resolver().finally(() => {
    authContextResolutionInFlight.delete(cacheKey);
  });

  authContextResolutionInFlight.set(cacheKey, resolutionPromise);
  return resolutionPromise;
}

function getOrCreateAuthUpstreamCircuitState(sessionEndpointUrl: string) {
  const existingState = authUpstreamCircuitByEndpoint.get(sessionEndpointUrl);
  if (existingState) {
    return existingState;
  }

  const state: AuthUpstreamCircuitState = {
    consecutiveFailures: 0,
    unavailableUntilMs: 0,
  };
  authUpstreamCircuitByEndpoint.set(sessionEndpointUrl, state);

  return state;
}

function isAuthUpstreamCircuitOpen(sessionEndpointUrl: string) {
  const state = authUpstreamCircuitByEndpoint.get(sessionEndpointUrl);
  if (!state) {
    return false;
  }

  const now = Date.now();
  if (state.unavailableUntilMs <= now) {
    state.unavailableUntilMs = 0;
    return false;
  }

  return true;
}

function markAuthUpstreamUnavailable(options: {
  sessionEndpointUrl: string;
  unavailableFailCacheTtlMs: number;
  unavailableFailureThreshold: number;
}) {
  if (options.unavailableFailCacheTtlMs <= 0) {
    return;
  }

  const state = getOrCreateAuthUpstreamCircuitState(options.sessionEndpointUrl);
  const now = Date.now();

  if (state.unavailableUntilMs > now) {
    return;
  }

  state.consecutiveFailures += 1;
  if (state.consecutiveFailures < options.unavailableFailureThreshold) {
    return;
  }

  state.consecutiveFailures = 0;
  state.unavailableUntilMs = now + options.unavailableFailCacheTtlMs;
}

function markAuthUpstreamAvailable(sessionEndpointUrl: string) {
  const state = authUpstreamCircuitByEndpoint.get(sessionEndpointUrl);
  if (!state) {
    return;
  }

  if (state.consecutiveFailures === 0 && state.unavailableUntilMs === 0) {
    return;
  }

  state.consecutiveFailures = 0;
  state.unavailableUntilMs = 0;
}

async function resolveFreshAuthContext(options: {
  requestHeaders: Headers;
  fetchImplementation: typeof fetch;
  sessionEndpointUrl: string;
  timeoutMs: number;
  retryAttempts: number;
  retryDelayMs: number;
  retryOnStatuses: Set<number>;
  entityOptions: ResolvedAuthContextEntityOptions;
}): Promise<AuthContextResolutionOutcome> {
  if (!hasAuthSignal(options.requestHeaders)) {
    return {
      unavailable: false,
      context: createUnauthenticatedContext(),
    };
  }

  const authSessionOutcome = await fetchAuthSessionPayloadWithRetry({
    fetchImplementation: options.fetchImplementation,
    sessionEndpointUrl: options.sessionEndpointUrl,
    requestHeaders: buildForwardedHeaders(options.requestHeaders),
    timeoutMs: options.timeoutMs,
    retryAttempts: options.retryAttempts,
    retryDelayMs: options.retryDelayMs,
    retryOnStatuses: options.retryOnStatuses,
  });

  if (authSessionOutcome.type === "unavailable") {
    return { unavailable: true };
  }

  if (authSessionOutcome.type === "unauthorized") {
    return {
      unavailable: false,
      context: createUnauthenticatedContext(),
    };
  }

  const payload = authSessionOutcome.payload;

  const organizationResolution = await resolveOrganizationContext({
    userId: normalizeId(payload.user.id),
    activeOrganizationId: normalizeId(payload.session.activeOrganizationId),
    includeOrganization: options.entityOptions.organization,
    includeHasOrganization: options.entityOptions.hasOrganization,
  });

  return {
    unavailable: false,
    context: buildHydratedAuthContext(payload, options.entityOptions, organizationResolution),
  };
}

async function resolveOrganizationContext(options: {
  userId: string | null;
  activeOrganizationId: string | null;
  includeOrganization: boolean;
  includeHasOrganization: boolean;
}): Promise<OrganizationResolution> {
  if (!options.userId || (!options.includeOrganization && !options.includeHasOrganization)) {
    return {
      organization: null,
      hasOrganization: false,
    };
  }

  let db;
  try {
    db = getDB();
  } catch {
    return {
      organization: null,
      hasOrganization: false,
    };
  }

  try {
    let hasOrganization = false;
    let organization: BetterAuthOrganizationRecord | null = null;

    if (options.activeOrganizationId) {
      const [activeMembership] = await db
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(
          and(
            eq(member.userId, options.userId),
            eq(member.organizationId, options.activeOrganizationId)
          )
        )
        .limit(1);

      if (activeMembership) {
        hasOrganization = true;

        if (options.includeOrganization) {
          const [organizationRecord] = await db
            .select()
            .from(authOrganizationTable)
            .where(eq(authOrganizationTable.id, options.activeOrganizationId))
            .limit(1);

          organization = (organizationRecord as BetterAuthOrganizationRecord | undefined) ?? null;
        }
      } else if (options.includeHasOrganization) {
        const [membershipRecord] = await db
          .select({ organizationId: member.organizationId })
          .from(member)
          .where(eq(member.userId, options.userId))
          .limit(1);

        hasOrganization = Boolean(membershipRecord);
      }
    } else if (options.includeHasOrganization) {
      const [membershipRecord] = await db
        .select({ organizationId: member.organizationId })
        .from(member)
        .where(eq(member.userId, options.userId))
        .limit(1);

      hasOrganization = Boolean(membershipRecord);
    }

    return {
      organization,
      hasOrganization,
    };
  } catch {
    return {
      organization: null,
      hasOrganization: false,
    };
  }
}

function buildHydratedAuthContext(
  payload: BetterAuthSessionPayload,
  entityOptions: ResolvedAuthContextEntityOptions,
  organizationResolution: OrganizationResolution
): SerializableAuthContext {
  const hasOrganization = entityOptions.hasOrganization
    ? organizationResolution.hasOrganization
    : false;

  return {
    isAuthenticated: true,
    data: entityOptions.data ? payload : null,
    user: entityOptions.user ? payload.user : null,
    session: entityOptions.session ? payload.session : null,
    organization: entityOptions.organization ? organizationResolution.organization : null,
    hasOrganization,
  };
}

export function createBetterAuthSessionMiddleware(
  options: CreateBetterAuthSessionMiddlewareOptions
): MiddlewareHandler {
  const fetchImplementation = options.fetchImplementation ?? fetch;
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const retryAttempts = Math.max(0, options.retryAttempts ?? DEFAULT_RETRY_ATTEMPTS);
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
  const unavailableFailCacheTtlMs = Math.max(
    0,
    options.unavailableFailCacheTtlMs ?? DEFAULT_UNAVAILABLE_FAIL_CACHE_TTL_MS
  );
  const unavailableFailureThreshold = Math.max(
    1,
    options.unavailableFailureThreshold ?? DEFAULT_UNAVAILABLE_FAILURE_THRESHOLD
  );
  const retryOnStatuses = new Set(options.retryOnStatuses ?? DEFAULT_RETRYABLE_STATUS_CODES);
  const required = options.required ?? false;
  const requiredEntities = normalizeRequiredEntities(options.requiredEntities);
  const skipPaths = options.skipPaths ?? DEFAULT_SKIP_PATHS;
  const sessionEndpointUrl = resolveSessionEndpointUrl(options);
  const cacheTtlMs = Math.max(0, options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS);
  const cacheMaxEntries = Math.max(100, options.cacheMaxEntries ?? DEFAULT_CACHE_MAX_ENTRIES);
  const enableRedisCache = options.enableRedisCache ?? true;
  const entityOptions = resolveEntityOptions(options.entities, requiredEntities);
  const entityScopeKey = buildEntityScopeKey(entityOptions);

  return async (c, next) => {
    if (shouldSkipPath(c.req.path, skipPaths)) {
      await next();
      return;
    }

    const cached = getCachedAuthContext(c);
    if (cached) {
      const accessErrorResponse = ensureRequiredAccess(c, cached, required, requiredEntities);
      if (accessErrorResponse) {
        return accessErrorResponse;
      }

      await next();
      return;
    }

    const authCacheKey =
      cacheTtlMs > 0
        ? createAuthCacheKey(c.req.raw.headers, sessionEndpointUrl, entityScopeKey)
        : null;

    if (authCacheKey) {
      const memoryCachedAuthContext = getCachedAuthContextFromMemory(authCacheKey);

      if (memoryCachedAuthContext) {
        setAuthContext(c, memoryCachedAuthContext);

        const accessErrorResponse = ensureRequiredAccess(
          c,
          memoryCachedAuthContext,
          required,
          requiredEntities
        );
        if (accessErrorResponse) {
          return accessErrorResponse;
        }

        await next();
        return;
      }

      if (enableRedisCache) {
        const redisCachedAuthContext = await readCachedAuthContextFromRedis(authCacheKey);
        if (redisCachedAuthContext) {
          setCachedAuthContextInMemory(
            authCacheKey,
            redisCachedAuthContext as SerializableAuthContext,
            cacheTtlMs,
            cacheMaxEntries
          );
          setAuthContext(c, redisCachedAuthContext);

          const accessErrorResponse = ensureRequiredAccess(
            c,
            redisCachedAuthContext,
            required,
            requiredEntities
          );
          if (accessErrorResponse) {
            return accessErrorResponse;
          }

          await next();
          return;
        }
      }
    }

    if (isAuthUpstreamCircuitOpen(sessionEndpointUrl)) {
      if (required) {
        return authServiceUnavailableResponse(c);
      }

      setAuthContext(c, createUnauthenticatedContext());
      await next();
      return;
    }

    const authContextResolutionOptions = {
      requestHeaders: c.req.raw.headers,
      fetchImplementation,
      sessionEndpointUrl,
      timeoutMs,
      retryAttempts,
      retryDelayMs,
      retryOnStatuses,
      entityOptions,
    };

    const authContextResolution = authCacheKey
      ? await getOrCreateAuthContextResolution(authCacheKey, () =>
          resolveFreshAuthContext(authContextResolutionOptions)
        )
      : await resolveFreshAuthContext(authContextResolutionOptions);

    if (authContextResolution.unavailable) {
      markAuthUpstreamUnavailable({
        sessionEndpointUrl,
        unavailableFailCacheTtlMs,
        unavailableFailureThreshold,
      });

      if (required) {
        return authServiceUnavailableResponse(c);
      }

      setAuthContext(c, createUnauthenticatedContext());
      await next();
      return;
    }

    const resolvedAuthContext = authContextResolution.context;
    markAuthUpstreamAvailable(sessionEndpointUrl);
    setAuthContext(c, resolvedAuthContext);

    if (authCacheKey) {
      setCachedAuthContextInMemory(authCacheKey, resolvedAuthContext, cacheTtlMs, cacheMaxEntries);
      if (enableRedisCache) {
        void setCachedAuthContextInRedis(
          authCacheKey,
          resolvedAuthContext,
          cacheTtlMs,
          options.redisCacheTtlSeconds
        );
      }
    }

    const accessErrorResponse = ensureRequiredAccess(
      c,
      resolvedAuthContext,
      required,
      requiredEntities
    );
    if (accessErrorResponse) {
      return accessErrorResponse;
    }

    await next();
  };
}

export function createRequiredAuthSessionMiddleware(
  options: Omit<CreateBetterAuthSessionMiddlewareOptions, "required">
): MiddlewareHandler {
  return createBetterAuthSessionMiddleware({
    ...options,
    required: true,
  });
}

export function getBetterAuthContext<
  TPayload extends BetterAuthSessionPayload = BetterAuthSessionPayload,
>(c: { get: (key: string) => unknown }): BetterAuthContextValue<TPayload> {
  const authContext = c.get(AUTH_CONTEXT_KEY) as BetterAuthContextValue<TPayload> | undefined;
  return authContext ?? createUnauthenticatedContext<TPayload>();
}
