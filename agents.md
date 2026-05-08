# Proptryx Server — Agent Context

> Full codebase reference for AI agents working on this monorepo.
> Keep this file updated as new services, routes, or patterns are added.

---

## Repository Overview

**Monorepo** managed with `pnpm` workspaces and `turborepo`.
**Language**: TypeScript (ESM), Node.js
**Framework**: [Hono](https://hono.dev/) with `@hono/zod-openapi` for typed OpenAPI routes
**ORM**: Drizzle ORM (PostgreSQL)
**Auth**: better-auth with Redis session storage
**Payments**: Razorpay SDK (`razorpay`, `better-auth-razorpay`)
**Email**: Custom `@proptryx/notification` package (React Email + Resend)
**Linter/Formatter**: Biome
**Build tool**: tsup
**Env management**: `@t3-oss/env-core` per service
**Logger**: Custom `@proptryx/logger` (structured, per-service)

---

## Directory Structure

```
proptryx-server/
├── services/
│   ├── auth/          # Better-Auth service (OAuth, credentials, org, Razorpay subs)
│   ├── company/       # Company-scoped portal (meetings, members)
│   ├── kernel/        # Admin/kernel operations (company CRUD, GST, zone/region, site data)
│   └── gateway/       # API gateway (proxies to all services, aggregates OpenAPI)
├── packages/
│   ├── database/      # Drizzle ORM schemas + DB init (shared by all services)
│   ├── utils/         # Shared utilities (list fetcher, RBAC, rate limit, crypto, Razorpay)
│   ├── notification/  # Email templates + send helper (React Email + Resend)
│   ├── logger/        # Structured logger factory
│   ├── static/        # Static assets
│   └── typescript-config/ # Shared tsconfig
├── env/               # Shared .env file (consumed by all services via --env-file)
└── turbo.json         # Turborepo pipeline config
```

---

## Services

### `services/auth` — Auth Service

**Port**: set via env `AUTH_PORT`
**Package**: `@proptryx/auth`

Handles all authentication via better-auth:
- Email/password credential login
- Google OAuth
- Email OTP
- Organization management (create, invite, switch)
- Razorpay subscription lifecycle (`better-auth-razorpay` plugin)

**Key files**:
- `src/lib/auth/index.ts` — better-auth instance config
- `src/index.ts` — Hono app entry, mounts auth handler
- `src/config/env.ts` — env validation with t3-oss/env-core

**Notes**:
- DB schema is auto-generated via `pnpm db:auth:generate` into `packages/database/src/schemas/auth/schema.ts`
- Redis is used for session storage (`ioredis`)
- Cookie domain is set via `BETTER_AUTH_COOKIE_DOMAIN` env

---

### `services/kernel` — Kernel Service

**Port**: set via env `KERNEL_PORT`
**Package**: `@proptryx/kernel`

Admin-level operations. Not company-scoped. Used by internal/admin panels.

**Routers**:

| Router | Path prefix | Purpose |
|--------|------------|---------|
| `company/main` | `/companies` | CRUD for organizations (companies) |
| `company/request` | `/company-requests` | Company onboarding request management + GST check |
| `company/member` | `/companies/:companyId/members` | Manage members of a specific company (admin view) |
| `zone-region` | `/zone-regions` | Zone and region management |
| `site-data/faqs` | `/site-data/faqs` | FAQ CRUD for public site |
| `site-data/testimonials` | `/site-data/testimonials` | Testimonial CRUD for public site |

**Key patterns**:
- Every route file has: `handler.ts`, `list.ts`, `utils.ts`, `schema.ts`, `openapi.route.ts`
- `list.ts` uses `createTableListFetcher` from `@proptryx/utils` for paginated, searchable, sortable lists
- Routes registered with `registerOpenApiRoute` wrapper
- Soft delete pattern: `isDeleted`, `deletedAt`, `deletedByUser` on every mutable table

**External integrations**:
- **GST API**: `http://sheet.gstincheck.co.in/check/{API_KEY}/{GST_NUMBER}` — used in both company/main and company/request to validate GST numbers
- **Razorpay**: customer upsert on company creation (`syncCompanyRazorpayCustomer` in `company/main/utils.ts`)

---

### `services/company` — Company Service

**Port**: set via env `COMPANY_PORT`
**Package**: `@proptryx/company`

Operations scoped to a logged-in company's organization context.

**Routers**:

| Router | Path prefix | Purpose |
|--------|------------|---------|
| `members` | `/members` | Manage members of the current org (RBAC-gated) |
| `meeting` | `/meetings` | Full meeting lifecycle management |

**Auth context pattern**:
```ts
const authCheck = resolveCurrentOrganizationAccess(c); // from @proptryx/utils
const { organizationId, user } = authCheck;
```

**Meeting lifecycle states**:
`REQUESTED → SCHEDULED → IN_PROGRESS → COMPLETED`
`REQUESTED/SCHEDULED → CANCELLED`
`REQUESTED → REJECTED`

Meeting lifecycle transitions enforced by `getMeetingLifecycleError()` in `meeting/utils.ts`.

---

### `services/gateway` — API Gateway

**Port**: set via env `GATEWAY_PORT`
**Package**: `@proptryx/gateway`

Proxies requests to upstream services and aggregates OpenAPI docs.
- No business logic
- Routes traffic to auth/kernel/company by path prefix
- Aggregates `/openapi.json` from all upstream services

---

## Shared Packages

### `@proptryx/database`

- **Schema location**: `src/schemas/`
  - `auth/schema.ts` — auto-generated by better-auth CLI (user, session, account, organization, member, etc.)
  - Additional custom tables: `meeting`, `company_request`, `zone`, `region`, `faq`, `testimonial`, etc.
- **DB init**: `src/index.ts` exports `db` and `getDB` (lazy getter)
- **Drizzle config**: `drizzle.config.ts` at root for migrations

### `@proptryx/utils`

Key exports:

| Export | Purpose |
|--------|---------|
| `createTableListFetcher` | Builds paginated/searchable/sortable list queries |
| `executeListQuery` | Underlying list query runner |
| `registerOpenApiRoute` | Wraps Hono OpenAPI route registration |
| `getBetterAuthContext` | Extracts `{ user, session, organization }` from Hono context |
| `resolveCurrentOrganizationAccess` | Resolves org-scoped auth (companyId from context) |
| `checkCurrentOrganizationLimit` | Plan-based feature limit check (from Hono context) |
| `checkOrganizationLimit` | Direct DB plan limit check (by orgId + featureName) |
| `generateRandomId` | Nanoid-based ID generation |
| `generateUID` | UUID generation |
| `getRazorpayClient` | Returns singleton Razorpay SDK instance |
| `PasswordUtils` | bcrypt hash/verify |
| `encryptPassword` / `decryptPassword` | AES encryption for stored passwords |
| `generateRandomPassword` | Random password generation |
| `generateNextCompanyId` | Sequential org ID generation |
| `ensureDefaultOrganizationRoles` | Seeds default roles into a new org |
| `buildOrganizationLimitDeniedMessage` | Formats plan limit error message |
| `createSuccessResponse` / `createErrorResponse` | Typed API response wrappers |
| `rateLimiter` | Redis-backed rate limiting middleware |

### `@proptryx/notification`

- `sendEmail({ to, subject, html })` — sends via Resend
- `renderAccountCredEmail(props)` — renders HTML for company owner credentials
- `renderMemberAccountCredEmail(props)` — renders HTML for member credentials
- `emailSubject` — map of email type → `{ subject, previewText }`

### `@proptryx/logger`

- `createServiceLogger(name)` — returns pino-based logger
- `createHonoRequestLogger()` — Hono middleware for request logging

---

## Common Patterns

### Route file structure

Every router module follows this layout:
```
routers/<domain>/
  handler.ts       # Route handlers (business logic)
  list.ts          # createTableListFetcher config
  utils.ts         # DB helpers (findById, etc.)
  schema.ts        # Zod schemas for request/response
  openapi.route.ts # OpenAPI route definitions
  index.ts         # Mounts the router
```

### Soft deletes

All mutable tables use soft deletes:
```ts
isDeleted: boolean  (default false)
deletedAt: Date | null
deletedByUser: string | null  (FK to user.id)
```
Every list query includes `where: eq(table.isDeleted, false)`.

### Fire-and-forget for side effects

Email sends and Razorpay sync must NOT block API responses.
Always use fire-and-forget with error logging:
```ts
renderAccountCredEmail({...})
  .then((html) => sendEmail({ to, subject, html }))
  .catch((err) => logger.error("[context] Email send failed:", { error: err }));
```
Never `await sendEmail(...)` in a request handler.

### List queries

All list endpoints use `createTableListFetcher` which provides:
- Pagination (`page`, `limit`, `offset`)
- Full-text and prefix search
- Fuzzy search via `pg_trgm` (with graceful fallback if extension unavailable)
- Sorting with custom sort definitions
- Filter columns
- Total count via `countDistinct`

### Transaction pattern

Multi-step DB writes use `db.transaction(async (tx) => { ... })`.
Side effects (email, Razorpay) are always performed AFTER the transaction, never inside it.

### Error responses

```ts
createErrorResponse({ error: "Not Found", message: "..." })
createSuccessResponse(data)
```

HTTP status codes follow REST conventions: 200, 201, 400, 401, 403, 404, 409, 500.

---

## Environment Variables (key ones)

| Variable | Used by |
|----------|---------|
| `DATABASE_URL` | All services (via @proptryx/database) |
| `BETTER_AUTH_SECRET` | auth, kernel, company (password encryption) |
| `BETTER_AUTH_COOKIE_DOMAIN` | auth |
| `GST_API_KEY` | kernel (GST validation) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | auth, kernel |
| `RESEND_API_KEY` | notification package |
| `REDIS_URL` | auth (sessions), utils (rate limiting) |
| `AUTH_PORT` / `KERNEL_PORT` / `COMPANY_PORT` / `GATEWAY_PORT` | Service entry points |

---

## Known Issues & Guardrails

### Do not `await sendEmail()` in handlers
Email delivery is a side effect. Always fire-and-forget. See fire-and-forget pattern above.

### GST API is HTTP (not HTTPS)
`http://sheet.gstincheck.co.in` — always check `gstResponse.ok` before calling `.json()`.

### Razorpay customer search
Use `razorpayClient.customers.all({ email })` to filter server-side.
Do NOT call `.all()` and filter in memory — that fetches every customer.

### Race conditions on email uniqueness
The conflict check (`findMemberConflictByEmail`, `findCompanyOwnerConflicts`) is not atomic.
The database `user.email` has a `unique()` constraint that will catch duplicates, but handle the resulting DB error gracefully.

### Double-fetch after mutations
Some handlers intentionally re-fetch after insert/update to return enriched data (with relations).
This is expected for `findCompanyById`, `findMeetingByIdWithRelations`.
Avoid unnecessary `.returning()` chains that are not used.

### pg_trgm extension
The company request list uses fuzzy search with `pg_trgm`. If the extension is not installed, `isPgTrgmUnavailableError` detects the error and falls back to prefix/contains search automatically.

---

## Development Commands

```bash
# Run all services in dev mode
pnpm dev

# Run a single service
pnpm --filter @proptryx/kernel dev

# Type-check all
pnpm type-check

# Lint
pnpm lint

# Generate better-auth DB schema
pnpm --filter @proptryx/auth db:auth:generate

# Build
pnpm build
```

---

## Adding a New Service

1. Create `services/<name>/` with `src/index.ts`, `src/config/env.ts`, `src/lib/logger.ts`
2. Copy `package.json` structure from an existing service, update `name`
3. Register in `pnpm-workspace.yaml` (if not already globbed)
4. Add turborepo pipeline entry in `turbo.json`
5. Add proxy route in `services/gateway/src/index.ts`
6. Add port env var to `env/.env` and all service `env.ts` files

## Adding a New Router

1. Create `src/routers/<domain>/` with the 6 standard files
2. Export the Hono group from `index.ts`
3. Mount in the service's main `src/index.ts`
4. Define OpenAPI routes in `openapi.route.ts` using `createRoute` from `@hono/zod-openapi`
5. Register handlers with `registerOpenApiRoute`
