import { OpenAPIHono } from "@hono/zod-openapi";
import { companyRequestGroup } from "./request/handler";
import type { AppBindings } from "@/types/app";
import { companyMainGroup } from "./main/handler";
import { companyMembersGroup } from "./member/handler";

export const companyGroup = new OpenAPIHono<AppBindings>();

// Mount specific subresources before the root company router so dynamic
// company routes like "/{id}" never shadow nested resource paths.
companyGroup.route("/members", companyMembersGroup);
companyGroup.route("/requests", companyRequestGroup);
companyGroup.route("/", companyMainGroup);
