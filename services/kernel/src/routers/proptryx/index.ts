import { OpenAPIHono } from "@hono/zod-openapi";
import type { AppBindings } from "@/types/app";
import { proptryxRolesPermissionGroup } from "./roles-permission/handler";
import { proptryxUsersGroup } from "./users/handler";

export const proptryxGroup = new OpenAPIHono<AppBindings>();

proptryxGroup.route("/roles-permission", proptryxRolesPermissionGroup);
proptryxGroup.route("/users", proptryxUsersGroup);
