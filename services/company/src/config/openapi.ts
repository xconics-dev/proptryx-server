/** biome-ignore-all lint/suspicious/noExplicitAny: forced */
import type { OpenAPIObjectConfigure } from "@hono/zod-openapi";

export const openApiInfo: OpenAPIObjectConfigure<any, any> = {
  openapi: "3.0.0",
  info: {
    title: "Company Service API",
    version: "1.0.0",
    description:
      "API for the Company service, which manages company members, meeting scheduling, lifecycle workflows, and meeting-centric coordination for the Proptryx platform.",
  },
  tags: [
    {
      name: "Members",
      description: "Company member management endpoints.",
    },
    {
      name: "Meetings",
      description:
        "Meeting request and scheduling endpoints, including developer and occupier availability, confirmation, completion, cancellation, rejection, and MOM publishing.",
    },
  ],
  "x-tagGroups": [
    {
      name: "Member APIs",
      tags: ["Members"],
    },
    {
      name: "Meeting APIs",
      tags: ["Meetings"],
    },
  ],
  servers: [
    {
      url: "/api/company",
      description: "Company API via Gateway",
    },
    {
      url: ".",
      description: "Company API (Direct Service)",
    },
  ],
};
