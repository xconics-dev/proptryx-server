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
  faqCreateSchema,
  faqListQuerySchema,
  faqListResponseSchema,
  faqPermanentDeleteResultSchema,
  faqSchema,
  faqUpdateSchema,
} from "./schema";

const tags = ["FAQs"];

const faqRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.faq,
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

const faqMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "faq-methods",
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "faqList",
  tags,
  middleware: [faqMethodsRateLimit],
  summary: "List FAQs",
  request: {
    query: faqListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(faqListResponseSchema, "FAQs fetched successfully"),
  },
});

export const get = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  operationId: "faqGetById",
  tags,
  middleware: [faqMethodsRateLimit],
  summary: "Get an FAQ by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(faqSchema, "FAQ fetched successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "faqCreate",
  tags,
  middleware: [faqMethodsRateLimit, allowProptryxBrokerOr(faqRbac.custom("create"))],
  summary: "Create an FAQ",
  request: {
    body: createApiJsonBody(faqCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(faqSchema, "FAQ created successfully"),
  },
});

export const update = createOpenApiRoute({
  method: "patch",
  path: "/{id}",
  operationId: "faqUpdateById",
  tags,
  middleware: [faqMethodsRateLimit, allowProptryxBrokerOr(faqRbac.custom("update"))],
  summary: "Update an FAQ by ID",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(faqUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(faqSchema, "FAQ updated successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const remove = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  operationId: "faqDeleteById",
  tags,
  middleware: [faqMethodsRateLimit, allowProptryxBrokerOr(faqRbac.custom("delete"))],
  summary: "Delete an FAQ by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(faqSchema, "FAQ deleted successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const restore = createOpenApiRoute({
  method: "post",
  path: "/{id}/restore",
  operationId: "faqRestoreById",
  tags,
  middleware: [faqMethodsRateLimit, allowProptryxBrokerOr(faqRbac.custom("update"))],
  summary: "Restore an FAQ by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(faqSchema, "FAQ restored successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const removePermanently = createOpenApiRoute({
  method: "delete",
  path: "/{id}/permanent",
  operationId: "faqPermanentDeleteById",
  tags,
  middleware: [faqMethodsRateLimit, allowProptryxBrokerOr(faqRbac.custom("delete"))],
  summary: "Permanently delete an FAQ by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      faqPermanentDeleteResultSchema,
      "FAQ permanently deleted successfully"
    ),
    404: ApiNotFoundOpenApi,
  },
});
