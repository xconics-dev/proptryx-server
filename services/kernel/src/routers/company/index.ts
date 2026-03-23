import { OpenAPIHono } from "@hono/zod-openapi";
import { companyRequestGroup } from "./request/handler";
import type { AppBindings } from "@/types/app";

export const companyGroup = new OpenAPIHono<AppBindings>();

companyGroup.route("/requests", companyRequestGroup);
