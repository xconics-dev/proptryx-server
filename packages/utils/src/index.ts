/** biome-ignore-all assist/source/organizeImports: forced */
export {
  createHealthCheckHandler,
  type HealthCheckCheckResult,
  type HealthCheckOptions,
  type HealthCheckProbe,
} from "./handlers/healthcheck";
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
  type RateLimitProfile,
} from "./middleware/rate-limit";

// Redis
export {
  closeRedisClient,
  getRedisClient,
  getRatelimiterRedisStorage,
  initializeRedisClient,
  AUTH_SESSION_REDIS_PREFIX,
  RATE_LIMIT_REDIS_NAMESPACE,
} from "./redis";

// Functions
export { generateUID, generateRandomId, generateNextCompanyId } from "./functions/gen-id";
export { PasswordUtils } from "./functions/password";
