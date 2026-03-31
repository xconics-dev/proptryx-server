import {
  getTableColumns,
  type InferInsertModel,
  type InferSelectModel,
  type Table,
} from "drizzle-orm";
import { z } from "@hono/zod-openapi";

type TableColumnKey<TTable extends Table> = Extract<keyof TTable["_"]["columns"], string>;

type InsertShape<TTable extends Table, TOmit extends TableColumnKey<TTable> = never> = {
  [TKey in keyof Omit<InferSelectModel<TTable>, TOmit>]-?: z.ZodType<
    TKey extends keyof Omit<InferInsertModel<TTable>, TOmit>
      ? Omit<InferInsertModel<TTable>, TOmit>[TKey]
      : Omit<InferSelectModel<TTable>, TOmit>[TKey] | undefined
  >;
};

type UpdateShape<TTable extends Table, TOmit extends TableColumnKey<TTable> = never> = {
  [TKey in keyof Partial<Omit<InferInsertModel<TTable>, TOmit>>]-?: z.ZodType<
    Partial<Omit<InferInsertModel<TTable>, TOmit>>[TKey]
  >;
};

type SelectShape<TTable extends Table, TOmit extends TableColumnKey<TTable> = never> = {
  [TKey in keyof Omit<InferSelectModel<TTable>, TOmit>]-?: z.ZodType<
    Omit<InferSelectModel<TTable>, TOmit>[TKey]
  >;
};

export type DbSchemaOptions<
  TShape extends z.ZodRawShape,
  TOmit extends string = never,
  TCustomizedSchema extends z.ZodTypeAny = z.ZodObject<TShape>,
> = {
  omit?: readonly TOmit[];
  zodObjectOptions?: Parameters<typeof z.object>[1];
  unknownKeys?: "strip" | "passthrough" | "strict";
  catchall?: z.ZodTypeAny;
  customizeSchema?: (schema: z.ZodObject<TShape>) => TCustomizedSchema;
};

function applySchemaOptions<
  TShape extends z.ZodRawShape,
  TCustomizedSchema extends z.ZodTypeAny = z.ZodObject<TShape>,
>(shape: TShape, options: Omit<DbSchemaOptions<TShape, string, TCustomizedSchema>, "omit">) {
  let schema: z.ZodObject<TShape> = z.object(shape, options.zodObjectOptions);

  switch (options.unknownKeys) {
    case "passthrough":
      schema = schema.passthrough();
      break;
    case "strict":
      schema = schema.strict();
      break;
    default:
      break;
  }

  if (options.catchall) {
    schema = schema.catchall(options.catchall);
  }

  return (options.customizeSchema ? options.customizeSchema(schema) : schema) as TCustomizedSchema;
}

/**
 * Returns the base Zod type for a column — no optional/nullable wrapping.
 * Callers wrap based on context (insert / update / select).
 */
function createColumnBaseSchema(column: {
  dataType: string;
  enumValues?: readonly string[];
}): z.ZodTypeAny {
  if (column.enumValues && column.enumValues.length > 0) {
    return z.enum([column.enumValues[0], ...column.enumValues.slice(1)] as [string, ...string[]]);
  }

  switch (column.dataType) {
    case "string":
      return z.string();
    case "number":
      return z.number();
    case "boolean":
      return z.boolean();
    case "date":
      return z.coerce.date();
    case "json":
      return z.unknown();
    case "array":
      return z.array(z.unknown());
    default:
      return z.unknown();
  }
}

// ─── Insert Schema ────────────────────────────────────────────────────────────
//
// Drizzle's InferInsertModel gives us:
//   notNull, no default  → T              (required)
//   notNull, has default → T | undefined  (optional — DB fills it)
//   nullable, no default → T | null       (required but nullable)
//   nullable, has default→ T | null | undefined (optional and nullable)
//
// We mirror that exactly:
//   required             → z.string()
//   optional             → z.string().optional()
//   nullable             → z.string().nullable()
//   optional + nullable  → z.string().nullish()

export function createDbInsertSchema<
  TTable extends Table,
  TOmit extends TableColumnKey<TTable> = never,
  TCustomizedSchema extends z.ZodTypeAny = z.ZodObject<InsertShape<TTable, TOmit>>,
>(
  table: TTable,
  options?: DbSchemaOptions<InsertShape<TTable, TOmit>, TOmit, TCustomizedSchema>
): TCustomizedSchema;
export function createDbInsertSchema<
  TTable extends Table,
  TOmit extends TableColumnKey<TTable> = never,
  TCustomizedSchema extends z.ZodTypeAny = z.ZodObject<InsertShape<TTable, TOmit>>,
>(
  table: TTable,
  options: DbSchemaOptions<InsertShape<TTable, TOmit>, TOmit, TCustomizedSchema> = {}
) {
  const omit = new Set<TableColumnKey<TTable>>(options.omit ?? []);
  const columns = getTableColumns(table);
  const shape = {} as InsertShape<TTable, TOmit>;

  for (const [columnName, column] of Object.entries(columns)) {
    if (omit.has(columnName as TableColumnKey<TTable>)) {
      continue;
    }

    const base = createColumnBaseSchema(column);
    const isOptional = column.hasDefault || column.generated !== undefined;
    const isNullable = !column.notNull;

    let fieldSchema: z.ZodTypeAny;

    if (isOptional && isNullable) {
      // T | null | undefined  →  nullish()
      fieldSchema = base.nullish();
    } else if (isOptional) {
      // T | undefined  →  optional()
      fieldSchema = base.optional();
    } else if (isNullable) {
      // T | null  →  nullable()
      fieldSchema = base.nullable();
    } else {
      // T  →  required as-is
      fieldSchema = base;
    }

    shape[columnName as keyof InsertShape<TTable, TOmit>] = fieldSchema as InsertShape<
      TTable,
      TOmit
    >[keyof InsertShape<TTable, TOmit>];
  }

  return applySchemaOptions(shape, options);
}

// ─── Update Schema ────────────────────────────────────────────────────────────
// Every field is optional for PATCH-style updates.
// Nullable columns stay nullable so callers can explicitly null them out.

export function createDbUpdateSchema<
  TTable extends Table,
  TOmit extends TableColumnKey<TTable> = never,
  TCustomizedSchema extends z.ZodTypeAny = z.ZodObject<UpdateShape<TTable, TOmit>>,
>(
  table: TTable,
  options?: DbSchemaOptions<UpdateShape<TTable, TOmit>, TOmit, TCustomizedSchema>
): TCustomizedSchema;
export function createDbUpdateSchema<
  TTable extends Table,
  TOmit extends TableColumnKey<TTable> = never,
  TCustomizedSchema extends z.ZodTypeAny = z.ZodObject<UpdateShape<TTable, TOmit>>,
>(
  table: TTable,
  options: DbSchemaOptions<UpdateShape<TTable, TOmit>, TOmit, TCustomizedSchema> = {}
) {
  const omit = new Set<TableColumnKey<TTable>>(options.omit ?? []);
  const columns = getTableColumns(table);
  const shape = {} as UpdateShape<TTable, TOmit>;

  for (const [columnName, column] of Object.entries(columns)) {
    if (omit.has(columnName as TableColumnKey<TTable>)) {
      continue;
    }

    const base = createColumnBaseSchema(column);
    const isNullable = !column.notNull;

    // For updates: always optional, preserve nullability
    shape[columnName as keyof UpdateShape<TTable, TOmit>] = (
      isNullable ? base.nullable().optional() : base.optional()
    ) as UpdateShape<TTable, TOmit>[keyof UpdateShape<TTable, TOmit>];
  }

  return applySchemaOptions(shape, options);
}

// ─── Select Schema ────────────────────────────────────────────────────────────
// All fields are always present in SELECT results (never undefined).
// Nullable columns (notNull === false) become .nullable().

export function createDbSelectSchema<
  TTable extends Table,
  TOmit extends TableColumnKey<TTable> = never,
  TCustomizedSchema extends z.ZodTypeAny = z.ZodObject<SelectShape<TTable, TOmit>>,
>(
  table: TTable,
  options?: DbSchemaOptions<SelectShape<TTable, TOmit>, TOmit, TCustomizedSchema>
): TCustomizedSchema;
export function createDbSelectSchema<
  TTable extends Table,
  TOmit extends TableColumnKey<TTable> = never,
  TCustomizedSchema extends z.ZodTypeAny = z.ZodObject<SelectShape<TTable, TOmit>>,
>(
  table: TTable,
  options: DbSchemaOptions<SelectShape<TTable, TOmit>, TOmit, TCustomizedSchema> = {}
) {
  const omit = new Set<TableColumnKey<TTable>>(options.omit ?? []);
  const columns = getTableColumns(table);
  const shape = {} as SelectShape<TTable, TOmit>;

  for (const [columnName, column] of Object.entries(columns)) {
    if (omit.has(columnName as TableColumnKey<TTable>)) {
      continue;
    }

    const base = createColumnBaseSchema(column);

    shape[columnName as keyof SelectShape<TTable, TOmit>] = (
      column.notNull ? base : base.nullable()
    ) as SelectShape<TTable, TOmit>[keyof SelectShape<TTable, TOmit>];
  }

  return applySchemaOptions(shape, options);
}
