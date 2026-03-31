import { DATABASE_RESOURCES } from "@proptryx/database";
import {
  createApiJsonBody,
  createApiSuccessResponse,
  createOpenApiRoute,
  createOperationalRateLimit,
  createResourceRbacGuards,
  DEFAULT_FAST_RBAC_AUTH_OPTIONS,
  IdStringParamSchema,
} from "@proptryx/utils";
import { companyCreateResponseSchema, companyCreateSchema, companySchema } from "./schema";

const tags = ["Company Operations"];

const companyRequestRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.organization,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const companyMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "company-methods",
});

// Query routes

export const get = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  tags,
  middleware: [companyMethodsRateLimit, companyRequestRbac.get],
  summary: "Get a company by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    404: {
      description: "Company not found",
    },
    200: createApiSuccessResponse(companySchema, "Company fetched successfully"),
  },
});

// Mutation routes
export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  tags,
  middleware: [companyMethodsRateLimit, companyRequestRbac.custom("create")],
  summary: "Create a new company",
  request: {
    body: createApiJsonBody(companyCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(companyCreateResponseSchema, "Company created successfully"),
  },
});

export const update = createOpenApiRoute({
  method: "patch",
  path: "/{id}",
  tags,
  middleware: [companyMethodsRateLimit, companyRequestRbac.custom("update")],
  summary: "Update a company by ID",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(companyCreateSchema.partial()),
  },
  responses: {
    200: createApiSuccessResponse(companySchema, "Company updated successfully"),
  },
});

export const remove = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  tags,
  middleware: [companyMethodsRateLimit, companyRequestRbac.custom("delete")],
  summary: "Delete a company by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    204: {
      description: "Company request deleted successfully",
    },
  },
});
