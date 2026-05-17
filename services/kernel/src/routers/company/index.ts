import { OpenAPIHono } from "@hono/zod-openapi";
import { companyRequestGroup } from "./request/handler";
import type { AppBindings } from "@/types/app";
import { companyMainGroup } from "./main/handler";
import { companyMembersGroup } from "./member/handler";
import { kernelCompanyPropertyGroup } from "./property";
import { companyBrokerRequestGroup } from "./request/broker/handler";
import { companyRolesPermissionGroup } from "./roles-permission/handler";

export const companyGroup = new OpenAPIHono<AppBindings>();

companyGroup.route("/members", companyMembersGroup);
companyGroup.route("/property", kernelCompanyPropertyGroup);
companyGroup.route("/request", companyRequestGroup);
companyGroup.route("/request/broker", companyBrokerRequestGroup);
companyGroup.route("/roles-permission", companyRolesPermissionGroup);
companyGroup.route("/", companyMainGroup);
