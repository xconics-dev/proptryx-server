import {
  getTableColumns,
  type InferInsertModel,
  type InferSelectModel,
  type Table,
} from "drizzle-orm";
import { z } from "@hono/zod-openapi";

export type DbSchemaOptions<TTable extends Table> = {
  omit?: Array<Extract<keyof TTable["_"]["columns"], string>>;
  zodObjectOptions?: Parameters<typeof z.object>[1];
  unknownKeys?: "strip" | "passthrough" | "strict";
  catchall?: z.ZodTypeAny;
  customizeSchema?: (schema: z.ZodObject<Record<string, z.ZodTypeAny>>) => z.ZodTypeAny;
};

function applySchemaOptions<TTable extends Table>(
  shape: Record<string, z.ZodTypeAny>,
  options: DbSchemaOptions<TTable>
) {
  let schema = z.object(shape, options.zodObjectOptions);

  switch (options.unknownKeys) {
    case "passthrough":
      schema = schema.passthrough();
      break;
    case "strict":
      schema = schema.strict();
      break;
    case "strip":
    default:
      break;
  }

  if (options.catchall) {
    schema = schema.catchall(options.catchall);
  }

  return options.customizeSchema ? options.customizeSchema(schema) : schema;
}

function createColumnSchema(column: {
  dataType: string;
  enumValues?: readonly string[];
  notNull: boolean;
  hasDefault: boolean;
}) {
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

export function createDbInsertSchema<TTable extends Table>(
  table: TTable,
  options: DbSchemaOptions<TTable> = {}
) {
  const omit = new Set(options.omit ?? []);
  const columns = getTableColumns(table);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [columnName, column] of Object.entries(columns)) {
    if (omit.has(columnName as Extract<keyof TTable["_"]["columns"], string>)) {
      continue;
    }

    const baseSchema = createColumnSchema(column);
    shape[columnName] = !column.notNull || column.hasDefault ? baseSchema.optional() : baseSchema;
  }

  return applySchemaOptions(shape, options) as unknown as z.ZodType<InferInsertModel<TTable>>;
}

export function createDbUpdateSchema<TTable extends Table>(
  table: TTable,
  options: DbSchemaOptions<TTable> = {}
) {
  const omit = new Set(options.omit ?? []);
  const columns = getTableColumns(table);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [columnName, column] of Object.entries(columns)) {
    if (omit.has(columnName as Extract<keyof TTable["_"]["columns"], string>)) {
      continue;
    }

    shape[columnName] = createColumnSchema(column).optional();
  }

  return applySchemaOptions(shape, options) as unknown as z.ZodType<
    Partial<InferInsertModel<TTable>>
  >;
}

export function createDbSelectSchema<TTable extends Table>(
  table: TTable,
  options: DbSchemaOptions<TTable> = {}
) {
  const omit = new Set(options.omit ?? []);
  const columns = getTableColumns(table);
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const [columnName, column] of Object.entries(columns)) {
    if (omit.has(columnName as Extract<keyof TTable["_"]["columns"], string>)) {
      continue;
    }

    const baseSchema = createColumnSchema(column);
    shape[columnName] = column.notNull ? baseSchema : baseSchema.nullable();
  }

  return applySchemaOptions(shape, options) as unknown as z.ZodType<InferSelectModel<TTable>>;
}
