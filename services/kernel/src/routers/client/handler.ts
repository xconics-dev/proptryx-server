import { OpenAPIHono } from "@hono/zod-openapi";
import { get } from "./openapi.route";
import type { AppBindings } from "@/types/app";

export const clientGroup = new OpenAPIHono<AppBindings>().openapi(get, async (c) => {
  const { id } = c.req.valid("param");
  const auth = c.get("auth");

  return c.json(
    {
      success: true,
      requestedClientId: id,
      auth,
    },
    200
  );
});
