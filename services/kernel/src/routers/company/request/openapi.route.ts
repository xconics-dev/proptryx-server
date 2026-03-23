import { z } from "zod";
import { DATABASE_RESOURCES } from "@proptryx/database";
import {
  createApiSuccessResponse,
  createOperationalRateLimit,
  createResourceRbacGuards,
  DEFAULT_FAST_RBAC_AUTH_OPTIONS,
  IdStringParamSchema,
} from "@proptryx/utils";
import { createKernelRoute } from "@/config/route";

const tags = ["Company Request Operations"];

const companyRequestRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.company_request,
  auth: DEFAULT_FAST_RBAC_AUTH_OPTIONS,
});

const companyMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "company-methods",
});

const companyRequestGetResponseSchema = z.object({
  requestedCompanyRequestId: z.string(),
  permission: z.object({
    resource: z.literal(DATABASE_RESOURCES.company_request),
    action: z.literal("get"),
    accessLevel: z.enum(["company", "user", "all"]).nullable(),
  }),
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
    200: createApiSuccessResponse(z.any(), "Company request fetched successfully"),
  },
});
