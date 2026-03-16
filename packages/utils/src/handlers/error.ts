import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export interface ErrorHandlerOptions {
  serviceName?: string;
  logger?: {
    error: (message: string, payload?: Record<string, unknown>) => void;
  };
}

const STATUS_CODE_BY_NAME: Record<string, number> = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  PAYMENT_REQUIRED: 402,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  METHOD_NOT_ALLOWED: 405,
  NOT_ACCEPTABLE: 406,
  CONFLICT: 409,
  GONE: 410,
  PRECONDITION_FAILED: 412,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503,
  GATEWAY_TIMEOUT: 504,
};

function getObjectProperty(record: unknown, key: string) {
  if (!record || typeof record !== "object") {
    return undefined;
  }

  return (record as Record<string, unknown>)[key];
}

function getDerivedStatus(error: unknown) {
  const statusCode = getObjectProperty(error, "statusCode");
  if (typeof statusCode === "number") {
    return statusCode;
  }

  const status = getObjectProperty(error, "status");
  if (typeof status === "number") {
    return status;
  }

  if (typeof status === "string") {
    return STATUS_CODE_BY_NAME[status] ?? 500;
  }

  return 500;
}

function getDerivedMessage(error: unknown, status: number) {
  const errorBody = getObjectProperty(error, "body");
  const bodyMessage = getObjectProperty(errorBody, "message");
  if (typeof bodyMessage === "string" && bodyMessage.length > 0) {
    return bodyMessage;
  }

  const message = getObjectProperty(error, "message");
  if (typeof message === "string" && message.length > 0) {
    return message;
  }

  return status >= 500 ? "Internal Server Error" : "Request failed";
}

export function createErrorHandler(options: ErrorHandlerOptions = {}) {
  return (error: Error, c: Context) => {
    const status = error instanceof HTTPException ? error.status : getDerivedStatus(error);
    const message = getDerivedMessage(error, status);
    const responseStatus = status as ContentfulStatusCode;

    options.logger?.error("request failed", {
      service: options.serviceName,
      method: c.req.method,
      path: c.req.path,
      status,
      error,
      errorBody: getObjectProperty(error, "body"),
    });

    return c.json(
      {
        success: false,
        error: status >= 500 ? "Internal Server Error" : message,
        message:
          status >= 500
            ? `An unexpected error occurred while processing ${c.req.method} ${c.req.path}`
            : message,
      },
      responseStatus
    );
  };
}
