/** biome-ignore-all lint/suspicious/noExplicitAny: forced */
import type { OpenAPIObjectConfigure } from "@hono/zod-openapi";

export const openApiInfo: OpenAPIObjectConfigure<any, any> = {
  openapi: "3.0.0",
  info: {
    title: "Notification Service API",
    version: "1.0.0",
    description:
      "API for dashboard notifications, web push subscriptions, notification preferences, templates, broadcasts, and internal notification events.",
  },
  tags: [
    {
      name: "Notifications",
      description: "Current-user notification inbox, read/archive/delete actions, and preferences.",
    },
    {
      name: "Proptryx / Notifications",
      description: "Proptryx admin notification templates, direct sends, and broadcasts.",
    },
    {
      name: "Internal Notifications",
      description: "Service-to-service event endpoints used by other backend services.",
    },
  ],
  "x-tagGroups": [
    {
      name: "User Notification APIs",
      tags: ["Notifications"],
    },
    {
      name: "Proptryx Notification APIs",
      tags: ["Proptryx / Notifications"],
    },
    {
      name: "Internal APIs",
      tags: ["Internal Notifications"],
    },
  ],
  servers: [
    {
      url: "/api/notifications",
      description: "Notification API via Gateway",
    },
    {
      url: ".",
      description: "Notification API (Direct Service)",
    },
  ],
};
