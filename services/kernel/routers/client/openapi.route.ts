import { createRoute } from "@hono/zod-openapi";
import { idStringParamSchema } from "@proptryx/utils";
const tags = ["Client Operations"];

export const get = createRoute({
  method: "get",
  path: "/{id}",
  tags,
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
