import type { DatabaseResource } from "@proptryx/database";
import type { MiddlewareHandler } from "hono";
import {
  createRequiredAuthSessionMiddleware,
  getBetterAuthContext,
  type BetterAuthContextValue,
  type BetterAuthContextEntityOptions,
  type BetterAuthRequiredEntity,
  type CreateBetterAuthSessionMiddlewareOptions,
} from "./auth";

export const RBAC_WILDCARD_RESOURCE = "*" as const;
export const RBAC_WILDCARD_ACTION = "*" as const;
export type RbacResource = DatabaseResource | typeof RBAC_WILDCARD_RESOURCE;
export const RBAC_ACTIONS = {
  activate: "activate",
  create: "create",
  deactivate: "deactivate",
  delete: "delete",
  get: "get",
  getAll: "getAll",
  publish: "publish",
  search: "search",
  terminate: "terminate",
  subscription: "subscription",
  unpublish: "unpublish",
  update: "update",
  view: "view",
} as const;
export type RbacAction =
  | (typeof RBAC_ACTIONS)[keyof typeof RBAC_ACTIONS]
  | typeof RBAC_WILDCARD_ACTION;

const LEGACY_RESOURCE_ALIASES = {
  client_request: "company_request",
  company_request: "client_request",
} as const satisfies Record<string, string>;

export interface PermissionCheck {
  resource: RbacResource;
  action: RbacAction;
}

export interface PermissionMiddlewareOptions extends PermissionCheck {
  requireOrganization?: boolean;
}

export interface CreateRbacMiddlewareOptions {
  permissions: PermissionCheck | PermissionCheck[];
  requireOrganization?: boolean;
  auth?: {
    enableRedisCache?: boolean;
    entities?: BetterAuthContextEntityOptions;
    requiredEntities?: BetterAuthRequiredEntity[];
    authServiceUrl?: string;
    sessionEndpointPath?: string;
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
    redisCacheTtlSeconds?: number;
  };
}

export interface CreateResourceRbacMiddlewareOptions {
  resource: RbacResource;
  requireOrganization?: boolean;
  auth?: CreateRbacMiddlewareOptions["auth"];
  customAction?: RbacAction;
  actionMap?: Partial<Record<Uppercase<"GET" | "POST" | "PUT" | "PATCH" | "DELETE">, RbacAction>>;
}

export interface CreateResourceRbacGuardsOptions
  extends Omit<CreateResourceRbacMiddlewareOptions, "customAction"> {}

export interface ResourceRbacGuards {
  get: MiddlewareHandler;
  post: MiddlewareHandler;
  put: MiddlewareHandler;
  patch: MiddlewareHandler;
  delete: MiddlewareHandler;
  custom: (action: RbacAction) => MiddlewareHandler;
}

export const DEFAULT_FAST_RBAC_AUTH_OPTIONS = {
  enableRedisCache: true,
  entities: {
    data: false,
    user: true,
    session: true,
    organization: false,
    hasOrganization: true,
  },
  // Keep recent auth context available a bit longer so short auth-service
  // restarts do not immediately turn protected read routes into 503s.
  cacheTtlMs: 60_000,
  redisCacheTtlSeconds: 60,
} as const satisfies NonNullable<CreateRbacMiddlewareOptions["auth"]>;

function normalizePermissionMap(
  authContext: BetterAuthContextValue | null | undefined
): BetterAuthContextValue["authorization"]["permissions"] {
  return authContext?.authorization?.permissions ?? {};
}

function getCandidateResources(resource: string): readonly string[] {
  const alias = LEGACY_RESOURCE_ALIASES[resource as keyof typeof LEGACY_RESOURCE_ALIASES];

  if (!alias || alias === resource) {
    return [resource];
  }

  return [resource, alias];
}

function resolvePermission(
  authContext: BetterAuthContextValue | null | undefined,
  resource: string,
  action: string
): boolean {
  if (!authContext) {
    return false;
  }

  const permissions = normalizePermissionMap(authContext);
  const wildcardPermission = permissions[RBAC_WILDCARD_RESOURCE];

  for (const candidateResource of getCandidateResources(resource)) {
    const resourcePermission = permissions[candidateResource];

    if (
      resourcePermission?.actions?.[action] ||
      resourcePermission?.actions?.[RBAC_WILDCARD_ACTION] ||
      wildcardPermission?.actions?.[action] ||
      wildcardPermission?.actions?.[RBAC_WILDCARD_ACTION]
    ) {
      return true;
    }
  }

  return false;
}

export function getPermissionAccessLevel(
  authContext: BetterAuthContextValue | null | undefined,
  resource: RbacResource
) {
  if (!authContext) {
    return null;
  }

  const permissions = normalizePermissionMap(authContext);

  for (const candidateResource of getCandidateResources(resource)) {
    const accessLevel = permissions[candidateResource]?.accessLevel;

    if (accessLevel) {
      return accessLevel;
    }
  }

  return permissions[RBAC_WILDCARD_RESOURCE]?.accessLevel ?? null;
}

export function hasPermission(
  authContext: BetterAuthContextValue | null | undefined,
  check: PermissionCheck | readonly PermissionCheck[]
): boolean {
  const checks = Array.isArray(check) ? check : [check];

  return checks.every((entry) => resolvePermission(authContext, entry.resource, entry.action));
}

export function createPermissionMiddleware(
  options: PermissionMiddlewareOptions
): MiddlewareHandler {
  return async (c, next) => {
    const authContext = getBetterAuthContext(c);

    if (!authContext.isAuthenticated || !authContext.user) {
      return c.json(
        {
          success: false,
          error: "Unauthorized",
          message: "Active session not found",
        },
        401
      );
    }

    if (options.requireOrganization && !authContext.member) {
      return c.json(
        {
          success: false,
          error: "Forbidden",
          message: "Organization membership is required",
        },
        403
      );
    }

    if (!hasPermission(authContext, options)) {
      return c.json(
        {
          success: false,
          error: "Forbidden",
          message: `Missing permission: ${options.resource}.${options.action}`,
        },
        403
      );
    }

    await next();
  };
}

export function createRbacMiddleware(options: CreateRbacMiddlewareOptions): MiddlewareHandler {
  const permissionChecks = Object.freeze(
    (Array.isArray(options.permissions) ? options.permissions : [options.permissions]).map(
      (check) => Object.freeze({ ...check })
    )
  ) as readonly PermissionCheck[];

  const authMiddleware = createRequiredAuthSessionMiddleware({
    ...options.auth,
    requiredEntities: Array.from(
      new Set(["user", ...(options.auth?.requiredEntities ?? [])])
    ) as CreateBetterAuthSessionMiddlewareOptions["requiredEntities"],
  });

  return async (c, next) => {
    let authPassed = false;
    const authResponse = await authMiddleware(c, async () => {
      authPassed = true;
    });

    if (!authPassed) {
      return authResponse;
    }

    const authContext = getBetterAuthContext(c);

    if (options.requireOrganization && !authContext.member) {
      return c.json(
        {
          success: false,
          error: "Forbidden",
          message: "Organization membership is required",
        },
        403
      );
    }

    if (!hasPermission(authContext, permissionChecks)) {
      return c.json(
        {
          success: false,
          error: "Forbidden",
          message: "Missing required RBAC permission",
          permissions: permissionChecks,
        },
        403
      );
    }

    await next();
  };
}

const DEFAULT_METHOD_ACTION_MAP: Record<
  Uppercase<"GET" | "POST" | "PUT" | "PATCH" | "DELETE">,
  RbacAction
> = {
  GET: RBAC_ACTIONS.get,
  POST: RBAC_ACTIONS.create,
  PUT: RBAC_ACTIONS.update,
  PATCH: RBAC_ACTIONS.update,
  DELETE: RBAC_ACTIONS.delete,
};

export function createResourceRbacMiddleware(
  options: CreateResourceRbacMiddlewareOptions
): MiddlewareHandler {
  const actionMap = {
    ...DEFAULT_METHOD_ACTION_MAP,
    ...(options.actionMap ?? {}),
  };
  const methodMiddlewareCache = new Map<string, MiddlewareHandler>();

  const getOrCreateMiddleware = (action: RbacAction) => {
    const cacheKey = `${options.resource}:${action}:${options.requireOrganization ? "org" : "global"}`;
    const cached = methodMiddlewareCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const middleware = createRbacMiddleware({
      auth: options.auth,
      requireOrganization: options.requireOrganization,
      permissions: [
        {
          resource: options.resource,
          action,
        },
      ],
    });

    methodMiddlewareCache.set(cacheKey, middleware);
    return middleware;
  };

  return async (c, next) => {
    const method = c.req.method.toUpperCase() as keyof typeof actionMap;
    const resolvedAction = options.customAction ?? actionMap[method];

    if (!resolvedAction) {
      return c.json(
        {
          success: false,
          error: "Forbidden",
          message: `RBAC action mapping is not configured for HTTP method ${method}`,
        },
        403
      );
    }

    return getOrCreateMiddleware(resolvedAction)(c, next);
  };
}

export function createResourceRbacGuards(
  options: CreateResourceRbacGuardsOptions
): ResourceRbacGuards {
  return {
    get: createResourceRbacMiddleware({
      ...options,
      customAction: options.actionMap?.GET ?? RBAC_ACTIONS.get,
    }),
    post: createResourceRbacMiddleware({
      ...options,
      customAction: options.actionMap?.POST ?? RBAC_ACTIONS.create,
    }),
    put: createResourceRbacMiddleware({
      ...options,
      customAction: options.actionMap?.PUT ?? RBAC_ACTIONS.update,
    }),
    patch: createResourceRbacMiddleware({
      ...options,
      customAction: options.actionMap?.PATCH ?? RBAC_ACTIONS.update,
    }),
    delete: createResourceRbacMiddleware({
      ...options,
      customAction: options.actionMap?.DELETE ?? RBAC_ACTIONS.delete,
    }),
    custom: (action: RbacAction) =>
      createResourceRbacMiddleware({
        ...options,
        customAction: action,
      }),
  };
}
