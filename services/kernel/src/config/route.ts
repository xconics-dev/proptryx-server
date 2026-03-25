import { createRoute } from "@hono/zod-openapi";
import type { RouteConfig } from "@hono/zod-openapi";
import {
  ApiBadRequestOpenApi,
  ApiForbiddenOpenApi,
  ApiInternalServerErrorOpenApi,
  ApiNotFoundOpenApi,
  ApiUnauthorizedOpenApi,
} from "@proptryx/utils";

const DEFAULT_ROUTE_RESPONSES = {
  400: ApiBadRequestOpenApi,
  401: ApiUnauthorizedOpenApi,
  403: ApiForbiddenOpenApi,
  404: ApiNotFoundOpenApi,
  500: ApiInternalServerErrorOpenApi,
} as const;

export function createKernelRoute<
  P extends string,
  R extends Omit<RouteConfig, "path"> & {
    path: P;
  },
>(config: R) {
  return createRoute({
    ...config,
    responses: {
      ...DEFAULT_ROUTE_RESPONSES,
      ...config.responses,
    },
  });
}

export { DEFAULT_ROUTE_RESPONSES };
