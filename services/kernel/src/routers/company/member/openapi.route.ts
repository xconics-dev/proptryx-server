import { DATABASE_RESOURCES } from "@proptryx/database";
import {
  createApiJsonBody,
  createApiSuccessResponse,
  createOpenApiRoute,
  createOperationalRateLimit,
  createResourceRbacGuards,
  DEFAULT_FAST_RBAC_AUTH_OPTIONS,
} from "@proptryx/utils";
import { memberCreateSchema, memberSchema } from "./schema";

const tags = ["Company"];

const companyRequestRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.organization,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const companyMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "company-member-methods",
});

// Mutation routes
export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  tags,
  middleware: [companyMethodsRateLimit, companyRequestRbac.custom("create")],
  summary: "Add a new member to the company",
  request: {
    body: createApiJsonBody(memberCreateSchema),
  },
  responses: {
    201: createApiSuccessResponse(memberSchema, "Member created successfully"),
  },
});
