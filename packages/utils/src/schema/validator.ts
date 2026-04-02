import { z } from "@hono/zod-openapi";

export const IdStringParamSchema = <T extends string = "id">(entity?: T) =>
  z.object({
    [entity ?? "id"]: z.string().min(1),
  } as Record<T extends string ? T : "id", z.ZodString>);

export const optionalBooleanQuerySchema = z.preprocess((value) => {
  if (value === "" || value === undefined || value === null) {
    return undefined;
  }

  if (value === true || value === "true") {
    return true;
  }

  if (value === false || value === "false") {
    return false;
  }

  return value;
}, z.boolean().optional());

const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

const ApiValidationErrorSchema = z.object({
  success: z.literal(false),
  error: z.literal("ValidationError"),
  message: z.string(),
  details: z.object({
    issues: z.array(
      z.object({
        code: z.string(),
        message: z.string(),
        path: z.array(z.union([z.string(), z.number()])),
        received: z.string().optional(),
      })
    ),
    name: z.string(),
  }),
});

function createApiSuccessSchema<TSchema extends z.ZodTypeAny>(dataSchema: TSchema) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}

function createApiJsonResponse<TSchema extends z.ZodTypeAny>(schema: TSchema, description: string) {
  return {
    description,
    content: {
      "application/json": {
        schema,
      },
    },
  };
}

export function createApiJsonBody<TSchema extends z.ZodTypeAny>(schema: TSchema) {
  return {
    content: {
      "application/json": {
        schema,
      },
    },
  } as const;
}

function createApiErrorResponse(description: string) {
  return createApiJsonResponse(ApiErrorSchema, description);
}

export function createApiSuccessResponse<TSchema extends z.ZodTypeAny>(
  dataSchema: TSchema,
  description: string
) {
  return createApiJsonResponse(createApiSuccessSchema(dataSchema), description);
}

export function createSuccessResponse<TData>(data: TData) {
  return {
    success: true as const,
    data,
  };
}

export function createErrorResponse<TDetails = unknown>(options: {
  error: string;
  message: string;
  details?: TDetails;
}) {
  return {
    success: false as const,
    error: options.error,
    message: options.message,
    ...(options.details === undefined ? {} : { details: options.details }),
  };
}

export function createInternalServerErrorResponse<TDetails = unknown>(
  message = "Internal server error",
  details?: TDetails
) {
  return createErrorResponse({
    error: "Internal Server Error",
    message,
    details,
  });
}

export const ApiBadRequestOpenApi = createApiJsonResponse(ApiErrorSchema, "Bad request");

export const ApiValidationErrorOpenApi = createApiJsonResponse(
  ApiValidationErrorSchema,
  "Validation error"
);

export const ApiUnauthorizedOpenApi = createApiErrorResponse("Unauthorized");

export const ApiForbiddenOpenApi = createApiErrorResponse("Forbidden");

export const ApiNotFoundOpenApi = createApiErrorResponse("Resource not found");

export const ApiInternalServerErrorOpenApi = createApiErrorResponse("Internal server error");
