import { Scalar } from "@scalar/hono-api-reference";

type ScalarHandlerOptions = Exclude<Parameters<typeof Scalar>[0], (...args: never[]) => unknown>;

export interface OpenApiDocsHandlerOptions extends Omit<ScalarHandlerOptions, "url"> {
  specUrl?: string;
}

export function createOpenApiDocsHandler(options: OpenApiDocsHandlerOptions) {
  const { specUrl = "./doc", ...scalarOptions } = options;

  return Scalar({
    ...scalarOptions,
    theme: scalarOptions.theme || "purple",
    ...(!("sources" in scalarOptions) ? { url: specUrl } : {}),
  });
}
