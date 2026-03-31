import { DATABASE_RESOURCES } from "@proptryx/database";
import {
  createApiJsonBody,
  createApiSuccessResponse,
  createOpenApiRoute,
  createOperationalRateLimit,
  createResourceRbacGuards,
  DEFAULT_FAST_RBAC_AUTH_OPTIONS,
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
