/** biome-ignore-all assist/source/organizeImports: forced */
export {
  createHealthCheckHandler,
  type HealthCheckCheckResult,
  type HealthCheckOptions,
  type HealthCheckProbe,
} from "./handlers/healthcheck";
export { createOpenApiDocsHandler, type OpenApiDocsHandlerOptions } from "./handlers/openapi-docs";
export { createNotFoundHandler } from "./handlers/not-found";
export { createErrorHandler, type ErrorHandlerOptions } from "./handlers/error";

// Middleware
export { applyAppSecurity, type AppSecurityOptions } from "./middleware/security";
export { createFaviconHandler, type FaviconHandlerOptions } from "./handlers/favicon";
export {
  createGlobalRateLimit,
  createOperationalRateLimit,
  createRateLimit,
  createTransactionalRateLimit,
  RATE_LIMIT_PRESETS,
  type CreateRateLimitOptions,
  type RateLimitDefinition,
  type RateLimitKeyScope,
  type RateLimitProfile,
} from "./middleware/rate-limit";
export {
  AUTH_CONTEXT_KEY,
  createBetterAuthSessionMiddleware,
  createRequiredAuthSessionMiddleware,
  type BetterAuthContextEntityOptions,
  getBetterAuthContext,
  type BetterAuthContextValue,
  type BetterAuthOrganizationRecord,
  type BetterAuthRequiredEntity,
  type BetterAuthSessionPayload,
  type BetterAuthSessionRecord,
  type BetterAuthUserRecord,
  type BetterAuthVariables,
  type CreateBetterAuthSessionMiddlewareOptions,
} from "./middleware/auth";

// Redis
export {
  closeRedisClient,
  getRedisClient,
  getRatelimiterRedisStorage,
  initializeRedisClient,
  AUTH_MIDDLEWARE_REDIS_NAMESPACE,
  AUTH_SESSION_REDIS_PREFIX,
  RATE_LIMIT_REDIS_NAMESPACE,
} from "./redis";

// Functions
export { generateUID, generateRandomId, generateNextCompanyId } from "./functions/gen-id";
export { PasswordUtils } from "./functions/password";
export {
  AUTH_SESSION_FORWARD_HEADERS,
  CLIENT_IP_HEADER_CANDIDATES,
  SECURITY_CORS_ALLOW_HEADERS,
  SECURITY_CORS_ALLOW_METHODS,
  SECURITY_CORS_EXPOSE_HEADERS,
  normalizeForwardedIp,
  resolveClientIpFromHeaderGetter,
} from "./functions/network";

// Schema
export * from "./schema";
