import { DATABASE_RESOURCES } from "@proptryx/database";
import {
  createApiJsonBody,
  ApiNotFoundOpenApi,
  createApiSuccessResponse,
  createOperationalRateLimit,
  createResourceRbacGuards,
  DEFAULT_FAST_RBAC_AUTH_OPTIONS,
  IdStringParamSchema,
} from "@proptryx/utils";
import { createKernelRoute } from "@/config/route";
import { companyRequestCreateSchema, companyRequestSchema } from "./schema";

const tags = ["Company Request Operations"];

const companyRequestRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.company_request,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const companyMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "company-methods",
});

export const get = createKernelRoute({
  method: "get",
  path: "/{id}",
  tags,
  middleware: [companyMethodsRateLimit, companyRequestRbac.get],
  summary: "Get a company request by ID",
  request: {
    params: IdStringParamSchema,
  },
  responses: {
    404: ApiNotFoundOpenApi,
    200: createApiSuccessResponse(companyRequestSchema, "Company request fetched successfully"),
  },
});

export const create = createKernelRoute({
  method: "post",
  path: "/",
  tags,
  middleware: [companyMethodsRateLimit, companyRequestRbac.custom("create")],
  summary: "Create a new company request",
  request: {
    body: createApiJsonBody(companyRequestCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(companyRequestSchema, "Company request created successfully"),
  },
});
