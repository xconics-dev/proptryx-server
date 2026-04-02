import { DATABASE_RESOURCES } from "@proptryx/database";
import {
  ApiNotFoundOpenApi,
  createApiJsonBody,
  createApiSuccessResponse,
  createOpenApiRoute,
  createOperationalRateLimit,
  createResourceRbacGuards,
  DEFAULT_FAST_RBAC_AUTH_OPTIONS,
  IdStringParamSchema,
} from "@proptryx/utils";
import {
  faqCreateSchema,
  faqListQuerySchema,
  faqListResponseSchema,
  faqSchema,
  faqUpdateSchema,
} from "./schema";

const tags = ["FAQs"];

const faqRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.faq,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

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
  middleware: [faqMethodsRateLimit, faqRbac.custom("create")],
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
  middleware: [faqMethodsRateLimit, faqRbac.custom("update")],
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
  middleware: [faqMethodsRateLimit, faqRbac.custom("delete")],
  summary: "Delete an FAQ by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(faqSchema, "FAQ deleted successfully"),
    404: ApiNotFoundOpenApi,
  },
});
