import { DATABASE_RESOURCES } from "@proptryx/database";
import { createRoute } from "@hono/zod-openapi";
import {
  createOperationalRateLimit,
  createResourceRbacGuards,
  DEFAULT_FAST_RBAC_AUTH_OPTIONS,
  idStringParamSchema,
} from "@proptryx/utils";

const tags = ["Company Request Operations"];

const companyRequestRbac = createResourceRbacGuards({
  resource: "company_request",
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const companyMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "company-methods",
});

export const get = createRoute({
  method: "get",
  path: "/{id}",
  tags,
  middleware: [companyMethodsRateLimit, companyRequestRbac.custom("get")],
  summary: "Get a company request by ID",
  request: {
    params: idStringParamSchema,
  },
  responses: {
    200: {
      description: "Successful response",
    },
    404: {
      description: "Company request not found",
    },
  },
});
