import { createRoute } from "@hono/zod-openapi";
import {
  createOperationalRateLimit,
  createRequiredAuthSessionMiddleware,
  idStringParamSchema,
} from "@proptryx/utils";

const tags = ["Client Operations"];

const requireClientSession = createRequiredAuthSessionMiddleware({
  enableRedisCache: true,
  entities: {
    data: false,
    user: true,
    session: true,
    organization: true,
    hasOrganization: true,
  },
  requiredEntities: ["user", "session"],
});

const clientMethodsRateLimit = createOperationalRateLimit({
  keyPrefix: "client-methods",
});

export const get = createRoute({
  method: "get",
  path: "/{id}",
  tags,
  middleware: [clientMethodsRateLimit, requireClientSession],
  summary: "Get an organization",
  request: {
    params: idStringParamSchema,
  },
  responses: {
    200: {
      description: "Successful response",
    },
  },
  404: {
    description: "Client not found",
  },
});
