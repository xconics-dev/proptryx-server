import { OpenAPIHono } from "@hono/zod-openapi";
import { DATABASE_RESOURCES } from "@proptryx/database";
import {
  createSuccessResponse,
  getBetterAuthContext,
  getPermissionAccessLevel,
  RBAC_ACTIONS,
} from "@proptryx/utils";
import { get } from "./openapi.route";
import type { AppBindings } from "@/types/app";

export const companyRequestGroup = new OpenAPIHono<AppBindings>().openapi(get, async (c) => {
  const { id } = c.req.valid("param");
  const auth = getBetterAuthContext(c);
  const accessLevel = getPermissionAccessLevel(auth, DATABASE_RESOURCES.company_request);

  return c.json(
    createSuccessResponse({
      requestedCompanyRequestId: id,
      permission: {
        resource: DATABASE_RESOURCES.company_request,
        action: RBAC_ACTIONS.get,
        accessLevel,
      },
    }),
    200
  );
});
