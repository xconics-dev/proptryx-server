import { z } from "zod";

export const IdNumberParamSchema = z.object({
  id: z.number().int().min(1).pipe(z.coerce.number()),
});

export const IdStringParamSchema = z.object({
  id: z.string().min(1),
});

export const ApiErrorSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  message: z.string(),
  details: z.unknown().optional(),
});

export const ApiValidationErrorSchema = z.object({
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

export function createApiSuccessSchema<TSchema extends z.ZodTypeAny>(dataSchema: TSchema) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
  });
}

export function createOpenApiJsonResponse<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  description: string
) {
  return {
    description,
    content: {
      "application/json": {
        schema,
      },
    },
  };
}

export function createApiErrorResponse(description: string) {
  return createOpenApiJsonResponse(ApiErrorSchema, description);
}

export function createApiSuccessResponse<TSchema extends z.ZodTypeAny>(
  dataSchema: TSchema,
  description: string
) {
  return createOpenApiJsonResponse(createApiSuccessSchema(dataSchema), description);
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

export const ZodHttpErrorSchema = z
  .object({
    success: z.literal(false),
    error: z.object({
      issues: z.array(
        z.object({
          received: z.string(),
          code: z.string(),
          path: z.array(z.union([z.string(), z.number()])),
          message: z.string(),
        })
      ),
      name: z.string(),
    }),
  })
  .partial()
  .optional();

export const ZodNotFoundSchema = z.object({
  success: z.literal(false),
  error: z.object({
    message: z.string(),
  }),
});

export const ZodConflictSchema = z.object({
  success: z.literal(false),
  error: z.object({
    name: z.string(),
    message: z.string(),
  }),
});

export const ZodBadRequestOpenApi = {
  description: "Validation error",
  content: {
    "application/json": {
      schema: ZodHttpErrorSchema,
    },
  },
};

export const ZodNotFoundOpenApi = {
  description: "Resource not found",
  content: {
    "application/json": {
      schema: ZodNotFoundSchema,
    },
  },
};

export const ZodConflictOpenApi = {
  description: "Conflict error",
  content: {
    "application/json": {
      schema: ZodConflictSchema,
    },
  },
};

export const ApiBadRequestOpenApi = createOpenApiJsonResponse(
  ApiValidationErrorSchema,
  "Validation error"
);

export const ApiUnauthorizedOpenApi = createApiErrorResponse("Unauthorized");

export const ApiForbiddenOpenApi = createApiErrorResponse("Forbidden");

export const ApiNotFoundOpenApi = createApiErrorResponse("Resource not found");

export const ApiConflictOpenApi = createApiErrorResponse("Conflict error");

export const ApiInternalServerErrorOpenApi = createApiErrorResponse("Internal server error");
