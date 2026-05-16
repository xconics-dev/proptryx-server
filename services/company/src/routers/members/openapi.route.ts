import { DATABASE_RESOURCES } from "@proptryx/database";
import {
  ApiNotFoundOpenApi,
  createApiJsonBody,
  createApiSuccessResponse,
  createOpenApiRoute,
  createOperationalRateLimit,
  createResourceRbacGuards,
  IdStringParamSchema,
} from "@proptryx/utils";
import {
  memberCreateSchema,
  memberDeleteWithUserResultSchema,
  memberListItemSchema,
  memberListQuerySchema,
  memberListResponseSchema,
  memberSchema,
  memberUpdateSchema,
} from "./schema";

const tags = ["Members"];

const companyRequestRbac = createResourceRbacGuards({
  resource: DATABASE_RESOURCES.member,
  auth: {
    enableRedisCache: true,
    entities: {
      data: false,
      user: true,
      session: true,
      organization: true,
      hasOrganization: true,
    },
    cacheTtlMs: 5_000,
    requiredEntities: ["organization"],
  },
});

const companyMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "company-member-methods",
});

export const list = createOpenApiRoute({
  method: "get",
  path: "/list",
  operationId: "companyMemberList",
  tags,
  middleware: [companyMethodsRateLimit, companyRequestRbac.custom("getAll")],
  summary: "List company members",
  request: {
    query: memberListQuerySchema,
  },
  responses: {
    200: createApiSuccessResponse(memberListResponseSchema, "Members fetched successfully"),
  },
});

export const get = createOpenApiRoute({
  method: "get",
  path: "/{id}",
  operationId: "companyMemberGetById",
  tags,
  middleware: [companyMethodsRateLimit, companyRequestRbac.get],
  summary: "Get a company member by ID",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(memberListItemSchema, "Member fetched successfully"),
    404: ApiNotFoundOpenApi,
  },
});

export const create = createOpenApiRoute({
  method: "post",
  path: "/",
  operationId: "companyMemberCreate",
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
  operationId: "companyMemberUpdateById",
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
  operationId: "companyMemberDeleteById",
  tags,
  middleware: [companyMethodsRateLimit, companyRequestRbac.custom("delete")],
  summary: "Remove a member from the company",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(memberSchema, "Member removed successfully"),
  },
});

export const remove_with_user = createOpenApiRoute({
  method: "delete",
  path: "/{id}/with-user",
  operationId: "companyMemberDeleteWithUserById",
  tags,
  middleware: [companyMethodsRateLimit, companyRequestRbac.custom("delete")],
  summary: "Remove a member and their user account also",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: createApiSuccessResponse(
      memberDeleteWithUserResultSchema,
      "Member with user removed successfully"
    ),
  },
});

export const resendCredentials = createOpenApiRoute({
  method: "post",
  path: "/{id}/resend-cred",
  operationId: "companyMemberResendCredentialsById",
  tags,
  middleware: [companyMethodsRateLimit, companyRequestRbac.custom("activate")],
  summary: "Resend credentials to a member",
  request: {
    params: IdStringParamSchema(),
  },
  responses: {
    200: {
      description: "Credentials resent successfully",
    },
    404: ApiNotFoundOpenApi,
  },
});
