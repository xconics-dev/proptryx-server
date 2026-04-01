# Reusable List Query Layer

## Overview

This project now has a reusable list/getAll layer for Drizzle-based APIs.

It is designed for:

- pagination
- search
- filters
- sorting
- joins
- custom business `where` conditions
- type-safe query validation with OpenAPI/Zod
- reusable response shape
- small service handlers

The goal is to keep most of the list logic inside `@proptryx/utils`, while each service only defines:

- its query schema
- its response item schema
- its list config
- its route handler

## Main Files

### Utility layer

- `packages/utils/src/schema/list-query.ts`
  - `createListQuerySchema(...)`
  - `createListResponseSchema(...)`
  - shared pagination/search/sort schema shape

- `packages/utils/src/functions/list-query.ts`
  - `executeListQuery(...)`
  - `createListFetcher(...)`
  - `bindListFetcher(...)`
  - `createTableListFetcher(...)`
  - reusable search/filter/sort helpers

### Company example

- `services/kernel/src/routers/company/main/schema.ts`
  - company-specific query and response schemas

- `services/kernel/src/routers/company/main/list.ts`
  - company-specific list config

- `services/kernel/src/routers/company/main/handler.ts`
  - thin handler that only validates input and calls the reusable fetcher

- `services/kernel/src/routers/company/main/openapi.route.ts`
  - route definition and OpenAPI wiring

## Schema Helpers

### `createListQuerySchema(...)`

Use this in service schema files to define list query params.

Base fields added automatically:

- `page`
- `limit`
- `offset`
- `search`
- `sortBy`
- `sortOrder`

You can also extend it with route-specific filters using `extraShape`.

Example:

```ts
export const companyListQuerySchema = createListQuerySchema({
  sortFields: companyListSortFields,
  extraShape: {
    isActive: optionalBooleanQuerySchema,
    type: z.enum(OrganizationType.enumValues).optional(),
    companyType: z.string().optional(),
    industry: z.string().optional(),
  },
});

export type CompanyListQuery = z.infer<typeof companyListQuerySchema>;
```

### `createListResponseSchema(...)`

Use this to generate a standard list response shape.

Base response fields:

- `items`
- `page`
- `limit`
- `offset`
- `totalItems`

Example:

```ts
export const companyListResponseSchema = createListResponseSchema(
  companyListItemSchema,
);
```

## Query Helpers

### `executeListQuery(...)`

This is the low-level reusable executor.

It handles:

- pagination
- base `where`
- search conditions
- exact column filters
- custom filters
- sorting
- data query
- total count

Use this directly only when you need full manual control.

### `createListFetcher(...)`

Creates a fetcher from a reusable preset, but still expects `db` and `params` at call time.

Useful when:

- you want to reuse the same query config
- you do not want to repeat `executeListQuery(...)`

### `bindListFetcher(...)`

Binds a DB instance or lazy DB resolver to a preset.

Important:

- `db` can be either `DB` or `() => DB`
- using `getDB` lazily avoids early module-load issues

Example:

```ts
const fetcher = bindListFetcher(getDB, preset);
```

### `createTableListFetcher(...)`

This is the main high-level reusable API.

It is meant for most service list routes.

It lets you pass one config object with:

- table
- select shape
- joins
- base `where`
- search config
- filter config
- sort config
- count behavior
- item mapper

This keeps service list files short and declarative.

## `createTableListFetcher(...)` Options

### Required

- `db`
  - accepts `DB` or `() => DB`

- `table`
  - the Drizzle table to query from

### Common optional fields

- `select`
  - defaults to all table columns
  - can be a custom object or `(columns) => ({ ... })`

- `joins`
  - function that receives the query builder and returns the joined builder

- `where`
  - base business condition
  - can be a static condition or a function using `params`

- `mapItem`
  - transforms raw selected rows into the API response shape

### Search options

`search` supports:

- `exact`
  - exact match using `eq(...)`

- `prefix`
  - prefix search using `ILIKE 'term%'`

- `contains`
  - contains search using `ILIKE '%term%'`

- `build`
  - custom search builder for special cases

Use `prefix` where possible for better performance.
Use `contains` only where it adds real value.

### Filter options

- `filterColumns`
  - easiest option
  - maps query param keys to columns and applies `eq(...)`

- `filters`
  - full custom filter definitions
  - supports:
    - `build`
    - `mode`
    - `shouldApply`

Use `filterColumns` for simple equality filters.
Use `filters` when business logic is more complex.

### Sorting options

- `sortColumns`
  - easiest option
  - maps `sortBy` keys to columns

- `sorting`
  - supports:
    - `defaultBy`
    - `defaultOrder`
    - custom sort definitions when needed

If `sortColumns` is enough, the utility auto-builds the sorting definitions.

### Count options

`counts` supports:

- `includeTotal`
- `totalJoins`

`totalJoins` can be:

- `false`
  - do not apply joins to that count query

- `"data"`
  - reuse the same joins as the data query

- custom function
  - apply custom joins for the total count query

This is useful for performance, especially when:

- data query needs joins
- total count does not need joins

## Company Route Pattern

The current `company` route is the reference implementation.

### `schema.ts`

Keep only:

- item schema
- list query schema
- response schema
- route-specific filter fields

### `list.ts`

Keep only the list config:

```ts
export const fetchCompanyList = createTableListFetcher({
  db: getDB,
  table: organization,
  select: (columns) => ({
    ...columns,
    ownerId: user.id,
    ownerName: user.name,
    ownerEmail: user.email,
    ownerPhoneNumber: user.phoneNumber,
  }),
  joins: companyListJoins,
  where: eq(organization.isDeleted, false),
  search: {
    exact: [organization.id],
    prefix: [
      organization.slug,
      organization.email,
      organization.phoneNumber,
      organization.gstNumber,
      user.email,
    ],
    contains: [organization.name, user.name],
  },
  filterColumns: {
    isActive: organization.isActive,
    type: organization.type,
    companyType: organization.companyType,
    industry: organization.industry,
  },
  sorting: { defaultBy: "createdAt", defaultOrder: "desc" },
  sortColumns: {
    id: organization.id,
    name: organization.name,
    email: organization.email,
    phoneNumber: organization.phoneNumber,
    isActive: organization.isActive,
    createdAt: organization.createdAt,
    updatedAt: organization.updatedAt,
  },
  mapItem: mapCompanyListItem,
});
```

### `handler.ts`

Keep the handler thin:

```ts
const query = c.req.valid("query");
const response = await fetchCompanyList(query);
return c.json(createSuccessResponse(response), 200);
```

This is the target pattern for future routes.

## Recommended Service Structure

For any new module, keep the split like this:

1. `schema.ts`
   - request query schema
   - item schema
   - list response schema

2. `list.ts`
   - `createTableListFetcher(...)` config only

3. `handler.ts`
   - validate query
   - call fetcher
   - return success response

4. `openapi.route.ts`
   - route definition only

This keeps business list logic reusable and handlers small.

## Performance Notes

The reusable list layer supports performance tuning, but good config still matters.

### Search

Fastest to slowest in general:

1. exact match
2. prefix search
3. contains search

Contains search with `ILIKE '%term%'` is the most expensive and should be limited to fields where users truly need partial matching.

### Counts

Every list request may run:

1. data query
2. total count query

If count queries reuse joins unnecessarily, they can become slow. That is why `counts.totalJoins` exists.

### Indexing

Sorting and filtering performance depends on DB indexes.

The company route now has additional DB indexes for common filters and sorts, but they only help after generating and applying a migration.

## Applying To Another Module

Use this checklist:

1. define `sortFields` in the route schema file
2. create `listQuerySchema` with `createListQuerySchema(...)`
3. export `type XListQuery = z.infer<typeof xListQuerySchema>`
4. create `listItemSchema`
5. create `listResponseSchema` with `createListResponseSchema(...)`
6. create `fetchXList` with `createTableListFetcher(...)`
7. keep the handler minimal
8. wire the route in `openapi.route.ts`

## Best Practices

- prefer `createTableListFetcher(...)` for normal CRUD list routes
- use lazy `db: getDB` instead of eagerly reading DB at module load time
- keep handlers thin
- keep route-specific config in `list.ts`
- use `filterColumns` first, and only use custom `filters` when needed
- use `sortColumns` first, and only use custom sort definitions when needed
- avoid broad contains search on many joined columns
- avoid unnecessary joins in count queries
- keep schema types derived from Zod/OpenAPI schemas to avoid duplicated request types

## Summary

The reusable list layer is built so that:

- utils own the generic query engine
- services only describe table-specific behavior
- handlers stay small
- schemas stay type-safe
- counts and search can be tuned for performance

For most routes, the standard approach should be:

- schema in `schema.ts`
- fetcher config in `list.ts`
- thin handler in `handler.ts`
- route declaration in `openapi.route.ts`
