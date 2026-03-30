import { createRoute, type OpenAPIHono, type RouteConfig } from "@hono/zod-openapi";
import type { Context, Env, Schema, ValidationTargets } from "hono";
import type { ZodType } from "zod";
import {
  ApiBadRequestOpenApi,
  ApiForbiddenOpenApi,
  ApiInternalServerErrorOpenApi,
  ApiNotFoundOpenApi,
  ApiUnauthorizedOpenApi,
} from "../schema/validator";

export const DEFAULT_ROUTE_RESPONSES = {
  400: ApiBadRequestOpenApi,
  401: ApiUnauthorizedOpenApi,
  403: ApiForbiddenOpenApi,
  404: ApiNotFoundOpenApi,
  500: ApiInternalServerErrorOpenApi,
} as const;

export type SharedRouteConfig<P extends string = string> = Omit<RouteConfig, "path"> & {
  path: P;
};

export function createOpenApiRoute<P extends string, R extends SharedRouteConfig<P>>(config: R) {
  return createRoute({
    ...config,
    responses: {
      ...DEFAULT_ROUTE_RESPONSES,
      ...(config.responses ?? {}),
    },
  });
}

type RequestPart<R extends RouteConfig, Part extends string> =
  R["request"] extends Record<string, unknown>
    ? Part extends keyof R["request"]
      ? R["request"][Part]
      : {}
    : {};

type HasUndefined<T> = undefined extends T ? true : false;

type InputTypeBase<
  R extends RouteConfig,
  Part extends string,
  Target extends keyof ValidationTargets,
> =
  RequestPart<R, Part> extends ZodType
    ? {
        in: {
          [K in Target]: HasUndefined<ValidationTargets[K]> extends true
            ? {
                [K2 in keyof import("zod").input<RequestPart<R, Part>>]?: import("zod").input<
                  RequestPart<R, Part>
                >[K2];
              }
            : {
                [K2 in keyof import("zod").input<RequestPart<R, Part>>]: import("zod").input<
                  RequestPart<R, Part>
                >[K2];
              };
        };
        out: {
          [K in Target]: import("zod").output<RequestPart<R, Part>>;
        };
      }
    : {};

type InputTypeJson<R extends RouteConfig> = R["request"] extends {
  body?: {
    content?: infer Content;
  };
}
  ? Content extends Record<string, { schema: ZodType }>
    ? {
        in: {
          json: import("zod").input<Content[keyof Content]["schema"]>;
        };
        out: {
          json: import("zod").output<Content[keyof Content]["schema"]>;
        };
      }
    : {}
  : {};

type InputTypeForm<R extends RouteConfig> = R["request"] extends {
  body?: {
    content?: infer Content;
  };
}
  ? Content extends Record<string, { schema: ZodType }>
    ? {
        in: {
          form: import("zod").input<Content[keyof Content]["schema"]>;
        };
        out: {
          form: import("zod").output<Content[keyof Content]["schema"]>;
        };
      }
    : {}
  : {};

type InputTypeParam<R extends RouteConfig> = InputTypeBase<R, "params", "param">;
type InputTypeQuery<R extends RouteConfig> = InputTypeBase<R, "query", "query">;
type InputTypeHeader<R extends RouteConfig> = InputTypeBase<R, "headers", "header">;
type InputTypeCookie<R extends RouteConfig> = InputTypeBase<R, "cookies", "cookie">;

type RouteRequestInput<R extends RouteConfig> = InputTypeParam<R> &
  InputTypeQuery<R> &
  InputTypeHeader<R> &
  InputTypeCookie<R> &
  InputTypeForm<R> &
  InputTypeJson<R>;

type ConvertPathType<T extends string> = T extends `${infer Start}/{${infer Param}}${infer Rest}`
  ? `${Start}/:${Param}${ConvertPathType<Rest>}`
  : T;

export type OpenApiRouteHandler<R extends RouteConfig, E extends Env> = (
  c: Context<E, ConvertPathType<R["path"]>, RouteRequestInput<R>>
) => Response | Promise<Response>;

export function registerOpenApiRoute<
  E extends Env,
  S extends Schema,
  BasePath extends string,
  R extends RouteConfig,
>(
  app: OpenAPIHono<E, S, BasePath>,
  route: R,
  handler: OpenApiRouteHandler<R, E>,
  hook?: unknown
): OpenAPIHono<E, S, BasePath> {
  return (app.openapi as typeof app.openapi)(route, handler as never, hook as never);
}
