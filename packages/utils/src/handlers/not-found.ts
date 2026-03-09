import type { Context } from "hono";

export function createNotFoundHandler() {
  return (c: Context) =>
    c.json(
      {
        success: false,
        error: "Not Found",
        message: `Route ${c.req.method} ${c.req.path} does not exist`,
      },
      404
    );
}
