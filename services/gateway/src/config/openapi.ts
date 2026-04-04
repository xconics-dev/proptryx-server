/** biome-ignore-all lint/suspicious/noExplicitAny: forced */
import type { OpenAPIObjectConfigure } from "@hono/zod-openapi";

export const openApiInfo: OpenAPIObjectConfigure<any, any> = {
  openapi: "3.0.0",
  info: {
    title: "Gateway Service API",
    version: "1.0.0",
    description:
      "API gateway for Proptryx services. This service handles gateway-level operations and proxies requests to downstream auth and kernel services.",
  },
  tags: [
    {
      name: "Gateway",
      description: "Gateway-local endpoints such as service health and documentation entrypoints.",
    },
    {
      name: "Auth Service (Proxied)",
      description:
        "Auth service scope exposed through gateway under /api/auth. Includes auth docs redirect and proxied health endpoint.",
    },
    {
      name: "Company Service (Proxied)",
      description:
        "Company service scope exposed through gateway under /api/company. Includes company root redirect and proxied health endpoint.",
    },
    {
      name: "Kernel Service (Proxied)",
      description:
        "Kernel service scope exposed through gateway under /api/kernel. Includes kernel root redirect and proxied health endpoint.",
    },
  ],
};
