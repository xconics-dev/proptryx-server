import { createRoute } from "@hono/zod-openapi";
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

export const createKernelRoute: typeof createRoute = ((config: Parameters<typeof createRoute>[0]) =>
  createRoute({
    ...config,
    responses: {
      ...DEFAULT_ROUTE_RESPONSES,
      ...config.responses,
    },
  })) as typeof createRoute;

export { DEFAULT_ROUTE_RESPONSES };
