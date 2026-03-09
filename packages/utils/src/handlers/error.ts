import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";

export interface ErrorHandlerOptions {
  serviceName?: string;
  logger?: {
    error: (message: string, payload?: Record<string, unknown>) => void;
  };
}

export function createErrorHandler(options: ErrorHandlerOptions = {}) {
  return (error: Error, c: Context) => {
    const status = error instanceof HTTPException ? error.status : 500;
    const message = status >= 500 ? "Internal Server Error" : error.message;

    options.logger?.error("request failed", {
      service: options.serviceName,
      method: c.req.method,
      path: c.req.path,
      status,
      error,
    });

    return c.json(
      {
        success: false,
        error: message,
        message:
          status >= 500
            ? `An unexpected error occurred while processing ${c.req.method} ${c.req.path}`
            : error.message,
      },
      status
    );
  };
}
