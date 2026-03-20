/** biome-ignore-all lint/suspicious/noExplicitAny: forced */
import type { OpenAPIObjectConfigure } from "@hono/zod-openapi";

export const openApiInfo: OpenAPIObjectConfigure<any, any> = {
  openapi: "3.0.0",
  info: {
    title: "Kernel Service API",
    version: "1.0.0",
    description:
      "API for the Kernel service, which handles internal client and organization setup, along with core business logic for the Proptryx platform. This service manages operations related to properties, tenants, leases, and other central entities, serving as the backbone of the system.",
  },
  servers: [
    {
      // Use gateway-scoped base path for docs-driven requests.
      url: "/api/kernel",
      description: "Kernel API via Gateway",
    },
    {
      // Keep direct access available when hitting kernel service standalone.
      url: ".",
      description: "Kernel API (Direct Service)",
    },
  ],
};
