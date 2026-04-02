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
import { memberCreateSchema, memberSchema, memberUpdateSchema } from "./schema";

const tags = ["Company / Members"];

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

export const update = createOpenApiRoute({
  method: "patch",
  path: "/{id}",
  tags,
  middleware: [companyMethodsRateLimit, companyRequestRbac.custom("update")],
  summary: "Update an existing member",
  request: {
    params: IdStringParamSchema(),
    body: createApiJsonBody(memberUpdateSchema),
  },
  responses: {
    200: createApiSuccessResponse(memberSchema, "Member updated successfully"),
  },
});

export const remove = createOpenApiRoute({
  method: "delete",
  path: "/{id}",
  tags,
  middleware: [companyMethodsRateLimit, companyRequestRbac.custom("delete")],
  summary: "Remove a member from the company",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    204: {
      description: "Member removed successfully",
    },
  },
});

export const remove_with_user = createOpenApiRoute({
  method: "delete",
  path: "/{id}/with-user",
  tags,
  middleware: [companyMethodsRateLimit, companyRequestRbac.custom("delete")],
  summary: "Remove a member and their user account also",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    204: {
      description: "Member with user removed successfully",
    },
  },
});
