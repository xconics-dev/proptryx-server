import { env } from "../config/env";

export * from "./templates";
export * from "./transporter";
export * from "./static/const";

export const reactEmailApp = {
  templatesDirectory: "src/email/templates",
  previewPort: env.EMAIL_PREVIEW_PORT,
} as const;
