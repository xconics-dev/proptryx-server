import { DATABASE_RESOURCES } from "@proptryx/database";
import {
  createApiJsonBody,
  ApiNotFoundOpenApi,
  createApiSuccessResponse,
  createOpenApiRoute,
  createOperationalRateLimit,
  createResourceRbacGuards,
  DEFAULT_FAST_RBAC_AUTH_OPTIONS,
  IdStringParamSchema,
} from "@proptryx/utils";
import {
  companyRequestListQuerySchema,
  companyRequestListResponseSchema,
  companyRequestBaseSchema,
  companyRequestCreateSchema,
  companyRequestSchema,
} from "./schema";

const tags = ["Company / Requests"];

const companyRequestRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.company_request,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const companyMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "company-request-methods",
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "companyRequestList",
  tags,
  middleware: [companyMethodsRateLimit, companyRequestRbac.custom("getAll")],
  summary: "List company requests",
  request: {
    query: companyRequestListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(
      companyRequestListResponseSchema,
      "Company requests fetched successfully"
    ),
  },
});

export const get = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  operationId: "companyRequestGetById",
  tags,
  middleware: [companyMethodsRateLimit, companyRequestRbac.get],
  summary: "Get a company request by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    404: ApiNotFoundOpenApi,
    200: createApiSuccessResponse(companyRequestSchema, "Company request fetched successfully"),
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "companyRequestCreate",
  tags,
  middleware: [companyMethodsRateLimit],
  summary: "Create a new company request",
  request: {
    body: createApiJsonBody(companyRequestCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(companyRequestBaseSchema, "Company request created successfully"),
  },
});

export const remove = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  operationId: "companyRequestDeleteById",
  tags,
  middleware: [companyMethodsRateLimit, companyRequestRbac.delete],
  summary: "Delete a company request by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    204: {
      description: "Company request deleted successfully",
    },
    404: ApiNotFoundOpenApi,
  },
});
