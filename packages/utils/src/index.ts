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
export {
  createOpenApiRoute,
  DEFAULT_ROUTE_RESPONSES,
  type OpenApiRouteHandler,
  registerOpenApiRoute,
  type SharedRouteConfig,
} from "./openapi/route";

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
  invalidateAuthMiddlewareCache,
  type BetterAuthContextEntityOptions,
  getBetterAuthContext,
  type BetterAuthAuthorizationContext,
  type BetterAuthMemberRecord,
  type BetterAuthContextValue,
  type BetterAuthOrganizationRecord,
  type BetterAuthPermissionActionMap,
  type BetterAuthResolvedPermission,
  type BetterAuthRequiredEntity,
  type BetterAuthRolePermissionRecord,
  type BetterAuthRoleRecord,
  type BetterAuthSessionPayload,
  type BetterAuthSessionRecord,
  type BetterAuthUserRecord,
  type BetterAuthVariables,
  type CreateBetterAuthSessionMiddlewareOptions,
} from "./middleware/auth";
export {
  RBAC_ACTIONS,
  RBAC_WILDCARD_ACTION,
  RBAC_WILDCARD_RESOURCE,
  DEFAULT_FAST_RBAC_AUTH_OPTIONS,
  createRbacMiddleware,
  createResourceRbacGuards,
  createResourceRbacMiddleware,
  createPermissionMiddleware,
  getPermissionAccessLevel,
  hasPermission,
  type CreateRbacMiddlewareOptions,
  type CreateResourceRbacGuardsOptions,
  type CreateResourceRbacMiddlewareOptions,
  type PermissionCheck,
  type PermissionMiddlewareOptions,
  type RbacAction,
  type RbacResource,
  type ResourceRbacGuards,
} from "./middleware/rbac";

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
export { getRazorpayClient, initializeRazorpayClient, resetRazorpayClient } from "./razorpay";

// Functions
export { generateUID, generateRandomId, generateNextCompanyId } from "./functions/gen-id";
export {
  DEFAULT_GST_UPSTREAM_TIMEOUT_MS,
  fetchGstInfoFromUpstream,
  GST_INVALID_MESSAGE,
  GST_UNAVAILABLE_MESSAGE,
} from "./functions/gst";
export {
  buildColumnSort,
  buildColumnSorts,
  buildEqualsFilter,
  bindListFetcher,
  createTableListFetcher,
  createListFetcher,
  executeListQuery,
  type ListFilterDefinition,
  type ListSearchPreset,
  type ListQueryPreset,
  type ListQueryOptions,
} from "./functions/list-query";
export { PasswordUtils, generateRandomPassword } from "./functions/password";
export { encryptPassword, decryptPassword } from "./functions/encrypt";
export {
  buildOrganizationLimitDeniedMessage,
  checkCurrentOrganizationLimit,
  ensureDefaultOrganizationRoles,
  getManagedRolePermission,
  getCurrentOrganizationLimits,
  isManagedRolePermissionResource,
  MANAGED_ACCOUNT_PERMISSION_ACCESS_LEVEL,
  MANAGED_ACCOUNT_PERMISSION_RESOURCE,
  mergeManagedRolePermissions,
  normalizeManagedRolePermission,
  resolveCurrentOrganizationAccess,
  type ActiveOrganizationAccess,
  type CurrentOrganizationLimitCheckResult,
} from "./functions/organization";
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
