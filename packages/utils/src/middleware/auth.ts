import { createHash } from "node:crypto";
import {
  getDB,
  member,
  organization as authOrganizationTable,
  rbacRole,
  rbacRolePermission,
  type session as authSessionTable,
  type user as authUserTable,
} from "@proptryx/database";
import { and, eq, isNull } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import type { Context, ContextVariableMap, MiddlewareHandler } from "hono";
import { env } from "../env";
import { AUTH_SESSION_FORWARD_HEADERS } from "../functions/network";
import { AUTH_MIDDLEWARE_REDIS_NAMESPACE, getRedisClient } from "../redis";

export const AUTH_CONTEXT_KEY = "auth" as const;

export type BetterAuthDbUserRecord = InferSelectModel<typeof authUserTable>;
export type BetterAuthDbSessionRecord = InferSelectModel<typeof authSessionTable>;
export type BetterAuthDbOrganizationRecord = InferSelectModel<typeof authOrganizationTable>;
export type BetterAuthDbMemberRecord = InferSelectModel<typeof member>;
export type BetterAuthDbRoleRecord = InferSelectModel<typeof rbacRole>;
export type BetterAuthDbRolePermissionRecord = InferSelectModel<typeof rbacRolePermission>;

export type BetterAuthSessionRecord = BetterAuthDbSessionRecord & Record<string, unknown>;
export type BetterAuthUserRecord = BetterAuthDbUserRecord & Record<string, unknown>;
export type BetterAuthOrganizationRecord = BetterAuthDbOrganizationRecord & Record<string, unknown>;
export type BetterAuthMemberRecord = BetterAuthDbMemberRecord & Record<string, unknown>;
export type BetterAuthRoleRecord = BetterAuthDbRoleRecord & Record<string, unknown>;
export type BetterAuthRolePermissionRecord = BetterAuthDbRolePermissionRecord &
  Record<string, unknown>;

export type BetterAuthPermissionActionMap = Record<string, boolean>;

export interface BetterAuthResolvedPermission {
  accessLevel: BetterAuthRolePermissionRecord["accessLevel"];
  actions: BetterAuthPermissionActionMap;
}

export interface BetterAuthAuthorizationContext {
  panel:
    | BetterAuthRoleRecord["panel"]
    | BetterAuthMemberRecord["panel"]
    | BetterAuthUserRecord["panel"];
  role: string | null;
  roleId: string | null;
  permissions: Record<string, BetterAuthResolvedPermission>;
}

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

export type BetterAuthRequiredEntity = "user" | "session" | "organization" | "member";

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
  member: BetterAuthMemberRecord | null;
  hasOrganization: boolean;
  authorization: BetterAuthAuthorizationContext;
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

type AuthorizationCacheRecord = {
  authorization: BetterAuthAuthorizationContext;
  expiresAt: number;
};

type OrganizationResolution = {
  organization: BetterAuthOrganizationRecord | null;
  hasOrganization: boolean;
  member: BetterAuthMemberRecord | null;
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
const DEFAULT_AUTHORIZATION_CACHE_TTL_MS = 60_000;
const DEFAULT_AUTHORIZATION_CACHE_MAX_ENTRIES = 2_000;

const authSessionCache = new Map<string, AuthSessionCacheRecord>();
const authorizationCache = new Map<string, AuthorizationCacheRecord>();
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
      requiredEntity === "organization" ||
      requiredEntity === "member"
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
    member: null,
    hasOrganization: false,
    authorization: {
      panel: null,
      role: null,
      roleId: null,
      permissions: {},
    },
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
    organization: "Required organization data",
    member: "Required organization member data",
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

    if (requiredEntity === "member" && !context.member) {
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

function pruneAuthorizationMemoryCache(maxEntries: number) {
  if (authorizationCache.size <= maxEntries) {
    return;
  }

  const overflow = authorizationCache.size - maxEntries;
  const keyIterator = authorizationCache.keys();

  for (let index = 0; index < overflow; index += 1) {
    const next = keyIterator.next();
    if (next.done) {
      return;
    }

    authorizationCache.delete(next.value);
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

function createAuthorizationCacheKey(options: {
  panel: string | null;
  role: string | null;
  organizationId: string | null;
}) {
  if (!options.panel || !options.role) {
    return null;
  }

  return `${AUTH_MIDDLEWARE_REDIS_NAMESPACE}:rbac:${hashIdentity(
    `${options.panel}|${options.role}|${options.organizationId ?? "global"}`
  )}`;
}

function getCachedAuthorizationFromMemory(cacheKey: string): BetterAuthAuthorizationContext | null {
  const cached = authorizationCache.get(cacheKey);
  if (!cached) {
    return null;
  }

  if (cached.expiresAt <= Date.now()) {
    authorizationCache.delete(cacheKey);
    return null;
  }

  return cached.authorization;
}

function setCachedAuthorizationInMemory(
  cacheKey: string,
  authorization: BetterAuthAuthorizationContext,
  ttlMs = DEFAULT_AUTHORIZATION_CACHE_TTL_MS,
  maxEntries = DEFAULT_AUTHORIZATION_CACHE_MAX_ENTRIES
) {
  if (ttlMs <= 0) {
    return;
  }

  authorizationCache.set(cacheKey, {
    authorization,
    expiresAt: Date.now() + ttlMs,
  });
  pruneAuthorizationMemoryCache(maxEntries);
}

async function readCachedAuthorizationFromRedis(
  cacheKey: string
): Promise<BetterAuthAuthorizationContext | null> {
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
      authorization?: BetterAuthAuthorizationContext;
    };

    if (typeof parsed.expiresAt !== "number" || parsed.expiresAt <= Date.now()) {
      void client.del(cacheKey);
      return null;
    }

    if (!parsed.authorization || typeof parsed.authorization !== "object") {
      void client.del(cacheKey);
      return null;
    }

    return parsed.authorization;
  } catch {
    return null;
  }
}

async function setCachedAuthorizationInRedis(
  cacheKey: string,
  authorization: BetterAuthAuthorizationContext,
  ttlMs = DEFAULT_AUTHORIZATION_CACHE_TTL_MS
) {
  const client = getReadyRedisClient();
  if (!client || ttlMs <= 0) {
    return;
  }

  const ttlSeconds = Math.max(1, Math.ceil(ttlMs / 1_000));

  try {
    await client.set(
      cacheKey,
      JSON.stringify({
        authorization,
        expiresAt: Date.now() + ttlSeconds * 1_000,
      }),
      "EX",
      ttlSeconds
    );
  } catch {
    // Ignore Redis cache write errors.
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

  const authorization = await resolveAuthorizationContext({
    user: payload.user,
    member: organizationResolution.member,
    activeOrganizationId: normalizeId(payload.session.activeOrganizationId),
  });

  return {
    unavailable: false,
    context: buildHydratedAuthContext(
      payload,
      options.entityOptions,
      organizationResolution,
      authorization
    ),
  };
}

async function resolveOrganizationContext(options: {
  userId: string | null;
  activeOrganizationId: string | null;
  includeOrganization: boolean;
  includeHasOrganization: boolean;
}): Promise<OrganizationResolution> {
  if (!options.userId) {
    return {
      organization: null,
      hasOrganization: false,
      member: null,
    };
  }

  let db;
  try {
    db = getDB();
  } catch {
    return {
      organization: null,
      hasOrganization: false,
      member: null,
    };
  }

  try {
    let hasOrganization = false;
    let organization: BetterAuthOrganizationRecord | null = null;
    let memberRecord: BetterAuthMemberRecord | null = null;

    if (options.activeOrganizationId) {
      const [activeMembership] = await db
        .select()
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
        memberRecord = activeMembership as BetterAuthMemberRecord;

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
      member: memberRecord,
    };
  } catch {
    return {
      organization: null,
      hasOrganization: false,
      member: null,
    };
  }
}

async function resolveAuthorizationContext(options: {
  user: BetterAuthSessionPayload["user"];
  member: BetterAuthMemberRecord | null;
  activeOrganizationId: string | null;
}): Promise<BetterAuthAuthorizationContext> {
  const memberRole = typeof options.member?.role === "string" ? options.member.role : null;
  const memberPanel = options.member?.panel ?? null;
  const userRole = typeof options.user.role === "string" ? options.user.role : null;
  const userPanel = typeof options.user.panel === "string" ? options.user.panel : null;
  const organizationRoleOrganizationId =
    options.activeOrganizationId ?? options.member?.organizationId ?? null;
  const role = memberRole ?? userRole;
  const panel = memberRole ? memberPanel : userPanel;
  const authorizationCacheKey = createAuthorizationCacheKey({
    panel,
    role,
    organizationId: memberRole ? organizationRoleOrganizationId : null,
  });

  if (!role) {
    return {
      panel,
      role: null,
      roleId: null,
      permissions: {},
    };
  }

  let db;
  try {
    db = getDB();
  } catch {
    return {
      panel,
      role,
      roleId: null,
      permissions: {},
    };
  }

  if (memberRole && !organizationRoleOrganizationId) {
    return {
      panel,
      role,
      roleId: null,
      permissions: {},
    };
  }

  if (authorizationCacheKey) {
    const memoryCachedAuthorization = getCachedAuthorizationFromMemory(authorizationCacheKey);
    if (memoryCachedAuthorization) {
      return memoryCachedAuthorization;
    }

    const redisCachedAuthorization = await readCachedAuthorizationFromRedis(authorizationCacheKey);
    if (redisCachedAuthorization) {
      setCachedAuthorizationInMemory(authorizationCacheKey, redisCachedAuthorization);
      return redisCachedAuthorization;
    }
  }

  try {
    const roleWhereClause = memberRole
      ? and(
          eq(rbacRole.panel, "company"),
          eq(rbacRole.slug, memberRole),
          eq(rbacRole.organizationId, organizationRoleOrganizationId as string)
        )
      : and(
          eq(rbacRole.panel, "proptryx"),
          eq(rbacRole.slug, userRole ?? ""),
          isNull(rbacRole.organizationId)
        );

    const [roleRecord] = await db.select().from(rbacRole).where(roleWhereClause).limit(1);

    if (!roleRecord) {
      return {
        panel,
        role,
        roleId: null,
        permissions: {},
      };
    }

    const permissionRows = await db
      .select()
      .from(rbacRolePermission)
      .where(eq(rbacRolePermission.roleId, roleRecord.id));

    const authorization = {
      panel: roleRecord.panel ?? panel,
      role,
      roleId: roleRecord.id,
      permissions: Object.fromEntries(
        permissionRows.map((permissionRow) => [
          permissionRow.resource,
          {
            accessLevel: permissionRow.accessLevel,
            actions: permissionRow.actions ?? {},
          },
        ])
      ),
    };

    if (authorizationCacheKey) {
      setCachedAuthorizationInMemory(authorizationCacheKey, authorization);
      void setCachedAuthorizationInRedis(authorizationCacheKey, authorization);
    }

    return authorization;
  } catch {
    return {
      panel,
      role,
      roleId: null,
      permissions: {},
    };
  }
}

function buildHydratedAuthContext(
  payload: BetterAuthSessionPayload,
  entityOptions: ResolvedAuthContextEntityOptions,
  organizationResolution: OrganizationResolution,
  authorization: BetterAuthAuthorizationContext
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
    member: organizationResolution.member,
    hasOrganization,
    authorization,
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
