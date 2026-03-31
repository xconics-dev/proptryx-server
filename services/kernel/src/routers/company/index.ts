import { OpenAPIHono } from "@hono/zod-openapi";
import { companyRequestGroup } from "./request/handler";
import type { AppBindings } from "@/types/app";
import { companyMainGroup } from "./main/handler";

export const companyGroup = new OpenAPIHono<AppBindings>();

companyGroup.route("/", companyMainGroup);
companyGroup.route("/requests", companyRequestGroup);
