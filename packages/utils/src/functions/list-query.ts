/** biome-ignore-all lint/suspicious/noExplicitAny: Drizzle query builders are intentionally accepted as flexible inputs here. */
import type { DB } from "@proptryx/database";
import {
  and,
  asc,
  countDistinct,
  desc,
  eq,
  getTableColumns,
  ilike,
  or,
  type SQL,
  type Table,
  type SQLWrapper,
} from "drizzle-orm";
import type { BaseListQueryParams, ListResponseData } from "../schema/list-query";

export type ListSortOrder = "asc" | "desc";

type ListQueryWhereResult = SQL | Array<SQL | undefined> | undefined;

type ListSortDefinition<TParams> = (
  args: Readonly<{
    direction: ListSortOrder;
    params: TParams;
  }>
) => SQL | SQL[];

export type ListFilterDefinition<TParams, TValue> = {
  build: (args: { value: TValue; params: TParams }) => ListQueryWhereResult;
  mode?: "and" | "or";
  shouldApply?: (value: TValue) => boolean;
};

type CountJoinOption<TParams extends BaseListQueryParams> =
  | false
  | "data"
  | ((builder: any, args: { params: TParams }) => any);

export type ListQueryOptions<TItem, TParams extends BaseListQueryParams> = {
  db: DB;
  select: any;
  from: any;
  countDistinctOn: any;
  params: TParams;
  joins?: (builder: any) => any;
  where?: ListQueryWhereResult | ((args: { params: TParams }) => ListQueryWhereResult);
  searchFields?: readonly any[];
  search?: {
    value?: string | null | undefined;
    fields?: readonly any[];
    build?: (args: { searchTerm: string; params: TParams }) => ListQueryWhereResult;
  };
  filterColumns?: Partial<Record<keyof TParams, SQLWrapper>>;
  filters?: Partial<{
    [TKey in keyof TParams]: ListFilterDefinition<TParams, TParams[TKey]>;
  }>;
  sortColumns?: Record<string, SQLWrapper>;
  sorting?: {
    sortBy?: string | null | undefined;
    sortOrder?: ListSortOrder | null | undefined;
    defaultBy: string;
    defaultOrder?: ListSortOrder;
    definitions?: Record<string, ListSortDefinition<TParams>>;
  };
  counts?: {
    includeTotal?: boolean;
    totalJoins?: CountJoinOption<TParams>;
  };
  mapItem?: (row: any) => TItem;
};

export type ListQueryPreset<TItem, TParams extends BaseListQueryParams> = Omit<
  ListQueryOptions<TItem, TParams>,
  "db" | "params"
>;

type TableSelectShape<TTable extends Table> = ReturnType<typeof getTableColumns<TTable>>;

export type ListSearchPreset<TParams extends BaseListQueryParams> = {
  exact?: readonly any[];
  prefix?: readonly any[];
  contains?: readonly any[];
  build?: (args: { searchTerm: string; params: TParams }) => ListQueryWhereResult;
};

export type TableListFetcherOptions<
  TTable extends Table,
  TItem,
  TParams extends BaseListQueryParams,
> = {
  db: DB | (() => DB);
  table: TTable;
  countDistinctOn?: SQLWrapper;
  select?: TableSelectShape<TTable> | ((columns: TableSelectShape<TTable>) => any);
  joins?: ListQueryPreset<TItem, TParams>["joins"];
  where?: ListQueryPreset<TItem, TParams>["where"];
  search?: ListSearchPreset<TParams>;
  filterColumns?: ListQueryPreset<TItem, TParams>["filterColumns"];
  filters?: ListQueryPreset<TItem, TParams>["filters"];
  sorting?: {
    defaultBy: string;
    defaultOrder?: ListSortOrder;
  };
  sortColumns?: Record<string, SQLWrapper>;
  counts?: ListQueryPreset<TItem, TParams>["counts"];
  mapItem?: (row: any) => TItem;
};

function normalizeString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function buildSearchConditions<TParams extends BaseListQueryParams>(
  searchTerm: string,
  search?: ListSearchPreset<TParams>
) {
  if (!search) {
    return [];
  }

  const prefixTerm = `${searchTerm}%`;
  const containsTerm = `%${searchTerm}%`;

  return [
    ...(search.exact?.map((field) => eq(field, searchTerm)) ?? []),
    ...(search.prefix?.map((field) => ilike(field, prefixTerm)) ?? []),
    ...(search.contains?.map((field) => ilike(field, containsTerm)) ?? []),
  ];
}

function toConditionArray(result: ListQueryWhereResult) {
  if (!result) {
    return [];
  }

  return (Array.isArray(result) ? result : [result]).filter(Boolean) as SQL[];
}

function combineConditions(result: ListQueryWhereResult, mode: "and" | "or" = "and") {
  const conditions = toConditionArray(result);

  if (conditions.length === 0) {
    return undefined;
  }

  if (conditions.length === 1) {
    return conditions[0];
  }

  return mode === "or" ? or(...conditions) : and(...conditions);
}

function applyJoinTransform(builder: any, joins?: (builder: any) => any) {
  return joins ? joins(builder) : builder;
}

function applyCountJoinTransform<TParams extends BaseListQueryParams>(
  builder: any,
  joinOption: CountJoinOption<TParams> | undefined,
  dataJoins: ListQueryOptions<unknown, TParams>["joins"],
  args: { params: TParams }
) {
  if (joinOption === false) {
    return builder;
  }

  if (joinOption === "data") {
    return applyJoinTransform(builder, dataJoins);
  }

  if (typeof joinOption === "function") {
    return joinOption(builder, args);
  }

  return builder;
}

function applyWhereClause(builder: any, whereClause?: SQL) {
  return whereClause ? builder.where(whereClause) : builder;
}

function resolvePagination(params: BaseListQueryParams) {
  const limit = params.limit;
  const offset = params.offset ?? (params.page - 1) * limit;
  const page = Math.floor(offset / limit) + 1;

  return { page, limit, offset };
}

function resolveBaseWhere<TParams extends BaseListQueryParams>(
  params: TParams,
  where?: ListQueryOptions<unknown, TParams>["where"]
) {
  return combineConditions(typeof where === "function" ? where({ params }) : where, "and");
}

function resolveSearchWhere<TParams extends BaseListQueryParams>(
  params: TParams,
  searchFields?: ListQueryOptions<unknown, TParams>["searchFields"],
  search?: ListQueryOptions<unknown, TParams>["search"],
  searchPreset?: ListSearchPreset<TParams>
) {
  const searchTerm = normalizeString(search?.value ?? params.search);

  if (!searchTerm) {
    return undefined;
  }

  const autoFieldConditions =
    (search?.fields ?? searchFields)?.map((field) => ilike(field, `%${searchTerm}%`)) ?? [];
  const presetConditions = buildSearchConditions(searchTerm, searchPreset);
  const customSearchWhere = combineConditions(
    [search?.build?.({ searchTerm, params }), searchPreset?.build?.({ searchTerm, params })].filter(
      Boolean
    ) as SQL[],
    "or"
  );

  return combineConditions(
    [...autoFieldConditions, ...presetConditions, customSearchWhere].filter(Boolean),
    "or"
  );
}

function resolveFilterWhere<TParams extends BaseListQueryParams>(
  params: TParams,
  filterColumns?: ListQueryOptions<unknown, TParams>["filterColumns"],
  filters?: ListQueryOptions<unknown, TParams>["filters"]
) {
  if (!filterColumns && !filters) {
    return undefined;
  }

  const filterClauses: SQL[] = [];

  for (const [filterKey, column] of Object.entries(filterColumns ?? {}) as [
    keyof TParams,
    SQLWrapper,
  ][]) {
    const value = params[filterKey];

    if (value !== undefined && value !== null && value !== "") {
      filterClauses.push(eq(column, value));
    }
  }

  if (!filters) {
    return combineConditions(filterClauses, "and");
  }

  for (const [filterKey, definition] of Object.entries(filters) as [
    keyof typeof filters,
    NonNullable<(typeof filters)[keyof typeof filters]>,
  ][]) {
    if (!definition) {
      continue;
    }

    const value = params[filterKey as keyof TParams];
    const shouldApply =
      definition.shouldApply?.(value as never) ??
      (value !== undefined && value !== null && value !== "");

    if (!shouldApply) {
      continue;
    }

    const clause = combineConditions(
      definition.build({
        value: value as never,
        params,
      }),
      definition.mode
    );

    if (clause) {
      filterClauses.push(clause);
    }
  }

  return combineConditions(filterClauses, "and");
}

function resolveOrderBy<TParams extends BaseListQueryParams>(
  params: TParams,
  sortColumns?: ListQueryOptions<unknown, TParams>["sortColumns"],
  sorting?: ListQueryOptions<unknown, TParams>["sorting"]
) {
  if (!sorting && !sortColumns) {
    return [];
  }

  const resolvedSorting = sorting
    ? {
        ...sorting,
        definitions: sorting.definitions ?? buildColumnSorts(sortColumns ?? {}),
      }
    : {
        defaultBy: Object.keys(sortColumns ?? {})[0] ?? "createdAt",
        definitions: buildColumnSorts(sortColumns ?? {}),
      };

  const sortBy =
    normalizeString(resolvedSorting.sortBy ?? params.sortBy) ?? resolvedSorting.defaultBy;
  const direction =
    resolvedSorting.sortOrder ?? params.sortOrder ?? resolvedSorting.defaultOrder ?? "desc";
  const sortDefinition =
    resolvedSorting.definitions[sortBy] ?? resolvedSorting.definitions[resolvedSorting.defaultBy];

  if (!sortDefinition) {
    return [];
  }

  const orderBy = sortDefinition({
    direction,
    params,
  });

  return Array.isArray(orderBy) ? orderBy : [orderBy];
}

export async function executeListQuery<TItem, TParams extends BaseListQueryParams>(
  options: ListQueryOptions<TItem, TParams>
): Promise<ListResponseData<TItem>> {
  const { page, limit, offset } = resolvePagination(options.params);

  const baseWhere = resolveBaseWhere(options.params, options.where);
  const searchWhere = resolveSearchWhere(options.params, options.searchFields, options.search);
  const filterWhere = resolveFilterWhere(options.params, options.filterColumns, options.filters);
  const filteredWhere = combineConditions(
    [baseWhere, searchWhere, filterWhere].filter(Boolean),
    "and"
  );

  let dataQuery: any = options.db.select(options.select).from(options.from);
  dataQuery = applyJoinTransform(dataQuery, options.joins);
  dataQuery = applyWhereClause(dataQuery, filteredWhere);

  const orderBy = resolveOrderBy(options.params, options.sortColumns, options.sorting);
  if (orderBy.length > 0) {
    dataQuery = dataQuery.orderBy(...orderBy);
  }

  const rows = await dataQuery.limit(limit).offset(offset);

  const includeTotal = options.counts?.includeTotal ?? true;

  const totalCountPromise = includeTotal
    ? (() => {
        let totalCountQuery: any = options.db
          .select({ count: countDistinct(options.countDistinctOn) })
          .from(options.from);
        totalCountQuery = applyCountJoinTransform(
          totalCountQuery,
          options.counts?.totalJoins ?? false,
          options.joins,
          { params: options.params }
        );
        totalCountQuery = applyWhereClause(totalCountQuery, baseWhere);
        return totalCountQuery;
      })()
    : Promise.resolve([{ count: 0 }]);

  const [totalCountRows] = await Promise.all([totalCountPromise]);

  return {
    items: options.mapItem ? rows.map(options.mapItem) : (rows as TItem[]),
    page,
    limit,
    offset,
    totalItems: includeTotal ? (totalCountRows[0]?.count ?? 0) : 0,
  };
}

export function createListFetcher<TItem, TParams extends BaseListQueryParams>(
  preset: ListQueryPreset<TItem, TParams>
) {
  return (db: DB, params: TParams) =>
    executeListQuery({
      db,
      params,
      ...preset,
    });
}

export function bindListFetcher<TItem, TParams extends BaseListQueryParams>(
  db: DB | (() => DB),
  preset: ListQueryPreset<TItem, TParams>
) {
  const fetcher = createListFetcher(preset);

  return (params: TParams) => fetcher(typeof db === "function" ? db() : db, params);
}

export function createTableListFetcher<
  TTable extends Table,
  TItem,
  TParams extends BaseListQueryParams,
>(options: TableListFetcherOptions<TTable, TItem, TParams>) {
  const tableColumns = getTableColumns(options.table);
  const select =
    typeof options.select === "function"
      ? options.select(tableColumns)
      : (options.select ?? tableColumns);

  const fetcher = bindListFetcher<TItem, TParams>(options.db, {
    select,
    from: options.table,
    countDistinctOn: options.countDistinctOn ?? (tableColumns as any).id ?? options.table,
    joins: options.joins,
    where: options.where,
    search: options.search
      ? {
          build: ({ searchTerm, params }) =>
            resolveSearchWhere(params, undefined, { value: searchTerm }, options.search),
        }
      : undefined,
    filterColumns: options.filterColumns,
    filters: options.filters,
    sorting: options.sorting,
    sortColumns: options.sortColumns,
    counts: options.counts,
    mapItem: options.mapItem,
  });

  return (params: TParams) => fetcher(params);
}

export function buildColumnSort(column: SQLWrapper): ListSortDefinition<BaseListQueryParams> {
  return ({ direction }) => (direction === "asc" ? asc(column) : desc(column));
}

export function buildColumnSorts<TField extends string>(
  columns: Record<TField, SQLWrapper>
): Record<TField, ListSortDefinition<BaseListQueryParams>> {
  const entries = Object.entries(columns) as [TField, SQLWrapper][];

  return Object.fromEntries(
    entries.map(([field, column]) => [field, buildColumnSort(column)])
  ) as Record<TField, ListSortDefinition<BaseListQueryParams>>;
}

export function buildEqualsFilter<TParams, TValue>(
  column: SQLWrapper
): ListFilterDefinition<TParams, TValue> {
  return {
    build: ({ value }) => eq(column, value),
  };
}
