import { DATABASE_RESOURCES } from "@proptryx/database";
import {
  ApiNotFoundOpenApi,
  createApiJsonBody,
  createApiSuccessResponse,
  createOpenApiRoute,
  createOperationalRateLimit,
  createResourceRbacGuards,
  DEFAULT_FAST_RBAC_AUTH_OPTIONS,
  getBetterAuthContext,
  IdStringParamSchema,
} from "@proptryx/utils";
import type { MiddlewareHandler } from "hono";
import {
  testimonialCreateSchema,
  testimonialListQuerySchema,
  testimonialListResponseSchema,
  testimonialPermanentDeleteResultSchema,
  testimonialSchema,
  testimonialUpdateSchema,
} from "./schema";

const tags = ["Testimonials"];

const testimonialRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.testimonial,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const allowProptryxBrokerOr =
  (middleware: MiddlewareHandler): MiddlewareHandler =>
  async (c, next) => {
    const authContext = getBetterAuthContext(c);
    const panel = authContext.authorization.panel ?? authContext.user?.panel ?? null;
    const role = authContext.authorization.role ?? authContext.user?.role ?? null;

    if (panel === "proptryx" && role?.trim().toLowerCase() === "broker") {
      await next();
      return;
    }

    return middleware(c, next);
  };

const testimonialMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "testimonial-methods",
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "testimonialList",
  tags,
  middleware: [
    testimonialMethodsRateLimit,
    allowProptryxBrokerOr(testimonialRbac.custom("getAll")),
  ],
  summary: "List testimonials",
  request: {
    query: testimonialListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(
      testimonialListResponseSchema,
      "Testimonials fetched successfully"
    ),
  },
});

export const get = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  operationId: "testimonialGetById",
  tags,
  middleware: [testimonialMethodsRateLimit, allowProptryxBrokerOr(testimonialRbac.custom("get"))],
  summary: "Get a testimonial by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(testimonialSchema, "Testimonial fetched successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "testimonialCreate",
  tags,
  middleware: [
    testimonialMethodsRateLimit,
    allowProptryxBrokerOr(testimonialRbac.custom("create")),
  ],
  summary: "Create a testimonial",
  request: {
    body: createApiJsonBody(testimonialCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(testimonialSchema, "Testimonial created successfully"),
  },
});

export const update = createOpenApiRoute({
  method: "patch",
  path: "/{id}",
  operationId: "testimonialUpdateById",
  tags,
  middleware: [
    testimonialMethodsRateLimit,
    allowProptryxBrokerOr(testimonialRbac.custom("update")),
  ],
  summary: "Update a testimonial by ID",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(testimonialUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(testimonialSchema, "Testimonial updated successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const remove = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  operationId: "testimonialDeleteById",
  tags,
  middleware: [
    testimonialMethodsRateLimit,
    allowProptryxBrokerOr(testimonialRbac.custom("delete")),
  ],
  summary: "Delete a testimonial by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(testimonialSchema, "Testimonial deleted successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const restore = createOpenApiRoute({
  method: "post",
  path: "/{id}/restore",
  operationId: "testimonialRestoreById",
  tags,
  middleware: [
    testimonialMethodsRateLimit,
    allowProptryxBrokerOr(testimonialRbac.custom("update")),
  ],
  summary: "Restore a testimonial by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(testimonialSchema, "Testimonial restored successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const removePermanently = createOpenApiRoute({
  method: "delete",
  path: "/{id}/permanent",
  operationId: "testimonialPermanentDeleteById",
  tags,
  middleware: [
    testimonialMethodsRateLimit,
    allowProptryxBrokerOr(testimonialRbac.custom("delete")),
  ],
  summary: "Permanently delete a testimonial by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      testimonialPermanentDeleteResultSchema,
      "Testimonial permanently deleted successfully"
    ),
    404: ApiNotFoundOpenApi,
  },
});
