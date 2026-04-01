import { z } from "@hono/zod-openapi";

export const DEFAULT_LIST_PAGE = 1;
export const DEFAULT_LIST_LIMIT = 10;
export const DEFAULT_LIST_MAX_LIMIT = 100;
export const ListSortOrderSchema = z.enum(["asc", "desc"]);

type ListQuerySchemaOptions<TExtraShape extends z.ZodRawShape = z.ZodRawShape> = {
  sortFields?: readonly string[];
  extraShape?: TExtraShape;
  defaultPage?: number;
  defaultLimit?: number;
  maxLimit?: number;
};

function emptyStringToUndefined(value: unknown) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function createBaseListQuerySchema(options: Omit<ListQuerySchemaOptions, "extraShape"> = {}) {
  const defaultPage = options.defaultPage ?? DEFAULT_LIST_PAGE;
  const defaultLimit = options.defaultLimit ?? DEFAULT_LIST_LIMIT;
  const maxLimit = options.maxLimit ?? DEFAULT_LIST_MAX_LIMIT;

  const sortBySchema =
    options.sortFields && options.sortFields.length > 0
      ? z.preprocess(
          emptyStringToUndefined,
          z
            .enum([options.sortFields[0], ...options.sortFields.slice(1)] as [string, ...string[]])
            .optional()
        )
      : z.preprocess(emptyStringToUndefined, z.string().optional());

  return z.object({
    page: z.coerce.number().int().min(1).default(defaultPage),
    limit: z.coerce.number().int().min(1).max(maxLimit).default(defaultLimit),
    offset: z.coerce.number().int().min(0).optional(),
    search: z.preprocess(emptyStringToUndefined, z.string().optional()),
    sortBy: sortBySchema,
    sortOrder: z.preprocess(emptyStringToUndefined, ListSortOrderSchema.default("desc").optional()),
  });
}

type ListQueryBaseSchema = ReturnType<typeof createBaseListQuerySchema>;

export function createListQuerySchema<TExtraShape extends z.ZodRawShape = z.ZodRawShape>(
  options: ListQuerySchemaOptions<TExtraShape> & { extraShape: TExtraShape }
): z.ZodObject<ListQueryBaseSchema["shape"] & TExtraShape>;
export function createListQuerySchema(options?: ListQuerySchemaOptions): ListQueryBaseSchema;
export function createListQuerySchema<TExtraShape extends z.ZodRawShape = z.ZodRawShape>(
  options: ListQuerySchemaOptions<TExtraShape> = {}
) {
  const { extraShape, ...baseOptions } = options;
  const baseSchema = createBaseListQuerySchema(baseOptions);

  return extraShape ? baseSchema.extend(extraShape) : baseSchema;
}

export function createListResponseSchema<TItemSchema extends z.ZodTypeAny>(
  itemSchema: TItemSchema
) {
  return z.object({
    items: z.array(itemSchema),
    page: z.number().int().min(1),
    limit: z.number().int().min(1),
    offset: z.number().int().min(0),
    totalItems: z.number().int().min(0),
  });
}

export type BaseListQueryParams = {
  page: number;
  limit: number;
  offset?: number;
  search?: string;
  sortBy?: string;
  sortOrder?: z.infer<typeof ListSortOrderSchema>;
};
export type ListResponseData<TItem> = {
  items: TItem[];
  page: number;
  limit: number;
  offset: number;
  totalItems: number;
};
