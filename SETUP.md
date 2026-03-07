# proptryx — Setup Guide

## Folder structure

```
proptryx/
├── pnpm-workspace.yaml              ← workspace roots: apps/ packages/ services/
├── package.json                     ← root scripts + devDependencies
├── turbo.json                       ← Turbo pipeline
├── tsup.config.ts                   ← single global build config (used by all services)
├── biome.json                       ← linter / formatter (extends ultracite)
├── .npmrc                           ← pnpm hoist / workspace settings
├── docker-compose.yml
│
├── apps/                            ← future Next.js / Expo apps (empty for now)
│
├── packages/
│   └── typescript-config/
│       ├── package.json             ← @proptryx/typescript-config
│       ├── base.json                ← shared tsconfig base
│       └── service.json            ← extends base, adds @/* alias
│
└── services/
    ├── gateway/                     ← @proptryx/gateway  :3000
    │   ├── Dockerfile
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── .env.example
    │   └── src/
    │       ├── index.ts
    │       ├── proxy.ts
    │       ├── config/env.ts        ← @t3-oss/env-core typesafe env
    │       └── routes/health.ts
    │
    ├── auth/                        ← @proptryx/auth     :3001
    │   ├── Dockerfile
    │   ├── package.json
    │   ├── tsconfig.json
    │   ├── .env.example
    │   └── src/
    │       ├── index.ts
    │       ├── config/env.ts
    │       └── routes/health.ts
    │
    └── property/                    ← @proptryx/property :3002
        ├── Dockerfile
        ├── package.json
        ├── tsconfig.json
        ├── .env.example
        └── src/
            ├── index.ts
            ├── config/env.ts
            └── routes/health.ts
```

---

## Prerequisites

```bash
node --version    # >= 20.x
pnpm --version    # >= 9.x  (install below)
docker --version  # >= 24.x
jq --version      # brew install jq / apt install jq
```

---

## 1 — Install pnpm

```bash
corepack enable
corepack prepare pnpm@9.15.4 --activate
pnpm --version
```

---

## 2 — Install all workspace packages

```bash
# From repo root — resolves all workspace symlinks in one shot
pnpm install
```

Workspace packages resolved:

| Name                          | Location                     |
|-------------------------------|------------------------------|
| `@proptryx/typescript-config` | packages/typescript-config   |
| `@proptryx/gateway`           | services/gateway             |
| `@proptryx/auth`              | services/auth                |
| `@proptryx/property`          | services/property            |

---

## 3 — Create .env files

```bash
cp services/gateway/.env.example  services/gateway/.env
cp services/auth/.env.example     services/auth/.env
cp services/property/.env.example services/property/.env
```

Edit each file before running locally.

---

## 4 — Add / install a dependency (from root terminal)

```bash
# Runtime dep to a specific service
pnpm --filter @proptryx/gateway  add <package>
pnpm --filter @proptryx/auth     add <package>
pnpm --filter @proptryx/property add <package>

# Dev dep to a specific service
pnpm --filter @proptryx/gateway  add -D <package>

# Dep to root (turbo, biome, etc.)
pnpm add -D -w <package>

# Add shared workspace package to a service
pnpm --filter @proptryx/gateway add @proptryx/typescript-config@workspace:*
```

---

## 5 — Development (local, no Docker)

```bash
# First build (compiles packages in dependency order)
pnpm build

# Start all services in parallel with Turbo
pnpm dev

# ─── Single service only ──────────────────────────────────────────────────────
pnpm dev:gateway
pnpm dev:auth
pnpm dev:property

# Raw pnpm --filter equivalents
pnpm --filter @proptryx/gateway  run dev
pnpm --filter @proptryx/auth     run dev
pnpm --filter @proptryx/property run dev
```

---

## 6 — Build

```bash
pnpm build                   # all services
pnpm build:gateway           # gateway only
pnpm build:auth              # auth only
pnpm build:property          # property only

# Raw equivalents
pnpm --filter @proptryx/gateway  run build
pnpm --filter @proptryx/auth     run build
pnpm --filter @proptryx/property run build
```

---

## 7 — Type checking

```bash
pnpm type-check              # all
pnpm type-check:gateway
pnpm type-check:auth
pnpm type-check:property

pnpm --filter @proptryx/auth run type-check   # raw
```

---

## 8 — Lint & format

```bash
pnpm lint            # all (Turbo cached)
pnpm lint:fix        # auto-fix all
pnpm lint:gateway    # single service
pnpm lint:auth
pnpm lint:property

pnpm format          # Biome format all
pnpm check:fix       # Biome lint + format all
```

---

## 9 — Docker

```bash
pnpm docker:up          # build + start all (foreground)
pnpm docker:up:d        # detached
pnpm docker:ps          # status
pnpm docker:logs        # tail all
pnpm docker:logs:gateway
pnpm docker:logs:auth
pnpm docker:logs:property
pnpm docker:down        # stop
pnpm docker:down:v      # stop + remove volumes
docker compose build --no-cache   # force full rebuild
```

---

## 10 — Health checks

```bash
pnpm health:gateway    # GET :3000/health                (gateway)
pnpm health:auth       # GET :3000/api/auth/health       (proxied → auth)
pnpm health:property   # GET :3000/api/property/health   (proxied → property)
```

Expected response:
```json
{ "success": true, "service": "auth", "status": "healthy", "timestamp": "...", "uptime": 12.3 }
```

---

## Service ports

| Service  | Package              | Local | Docker container |
|----------|----------------------|-------|------------------|
| gateway  | `@proptryx/gateway`  | 3000  | `gateway`        |
| auth     | `@proptryx/auth`     | 3001  | `auth`           |
| property | `@proptryx/property` | 3002  | `property`       |

---

## 11 — Clean

```bash
pnpm clean              # all dist/ + .turbo/ + node_modules
pnpm clean:gateway
pnpm clean:auth
pnpm clean:property

# Full reset
pnpm clean && pnpm install
```
