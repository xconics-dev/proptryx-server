import { OpenAPIHono } from "@hono/zod-openapi";
import { companyRequestGroup } from "./request/handler";
import type { AppBindings } from "@/types/app";
import { companyMainGroup } from "./main/handler";
import { companyMembersGroup } from "./member/handler";
import { companyBrokerRequestGroup } from "./request/broker/handler";

export const companyGroup = new OpenAPIHono<AppBindings>();

companyGroup.route("/members", companyMembersGroup);
companyGroup.route("/request", companyRequestGroup);
companyGroup.route("/request/broker", companyBrokerRequestGroup);
companyGroup.route("/", companyMainGroup);
