# Proptryx Server

Proptryx Server is a TypeScript microservice monorepo built around Hono, with:

- `gateway` (edge/API router + reverse proxy)
- `auth` (authentication domain service)
- `kernel` (shared core domain service)
- shared packages (`logger`, `typescript-config`)

The stack is optimized for:

- fast local development with Turbo + pnpm workspaces
- reusable service patterns
- predictable Docker builds with the repo-pinned `pnpm@10.33.2`
- production-ready structured logging and health checks

## Architecture Overview

### Service topology

- `gateway` is the entrypoint service
- `gateway` proxies `/api/auth/*` to `auth`
- `gateway` proxies `/api/kernel/*` to `kernel`
- each service also exposes its own `/health` endpoint

### Runtime model

- all services run as separate Node.js processes/containers
- each service is independently buildable/deployable
- shared code comes from workspace packages (`@proptryx/logger`, TS configs)

### Logging model

- centralized logger package: `@proptryx/logger`
- service-level logger wrapper per service (`src/lib/logger.ts`)
- Hono request middleware for consistent request logs
- shared logging env for all services:
  - `LOG_LEVEL=debug|info|warn|error|fatal`
  - `LOG_FORMAT=pretty|json`
  - `LOG_HEALTHCHECKS=true|false`
- compose passes the same logging config into every service container

## Monorepo Structure

```text
.
├── docker/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   ├── gateway.Dockerfile
│   ├── auth.Dockerfile
│   ├── kernel.Dockerfile
│   └── company.Dockerfile
├── env/
│   ├── .env
│   ├── .env.example
│   └── .env.prod
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── tsup.config.ts
├── packages
│   ├── logger
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/index.ts
│   └── typescript-config
│       ├── base.json
│       └── service.json
├── scripts
│   └── add-service.sh
└── services
    ├── gateway
    │   └── src
    ├── auth
    │   └── src
    └── kernel
        └── src
```

## Build & Tooling

- package manager: `pnpm@10.33.2`
- workspace orchestration: Turbo
- transpile/bundle: `tsup`
- runtime: Node 20 + ESM
- framework: Hono (+ `@hono/node-server`)
- schema/env validation: `zod` + `@t3-oss/env-core`

Common commands:

```bash
pnpm install --no-frozen-lockfile
pnpm -r type-check
pnpm -r build
pnpm dev
pnpm docker:up:build
pnpm docker:prod:up:build:d
```

## Documentation

- [docs/SETUP.md](docs/SETUP.md)
- [docs/DOCKER_PROD_SETUP.md](docs/DOCKER_PROD_SETUP.md)
- [docs/DOCKPLOY_SWARM_DEPLOY.md](docs/DOCKPLOY_SWARM_DEPLOY.md)
- [docs/NEW_SERVICE_CONFIG.md](docs/NEW_SERVICE_CONFIG.md)
- [docs/SCRIPTS.md](docs/SCRIPTS.md)
- [docs/GITHUB_AUTOMATION.md](docs/GITHUB_AUTOMATION.md)
- [docs/JENKINS_DEPLOYMENT.md](docs/JENKINS_DEPLOYMENT.md)
- [docs/REUSABLE_LIST_QUERY.md](docs/REUSABLE_LIST_QUERY.md)

## Docker Optimization & Compatibility

Current Docker strategy per service:

1. Base stage uses Node 20 Alpine + `pnpm@10.33.2` via Corepack
2. Build stage installs workspace deps and builds:
   - shared logger package first
   - target service second
3. `pnpm deploy --prod --legacy` creates minimal runtime dependency set
4. Runner stage is non-root and only copies deployed runtime output

Compose-level compatibility defaults:

- shared service defaults via YAML anchors:
  - restart policy
  - network attachment
  - default production logging env
- per-service healthchecks and explicit exposed ports

## Pros And Cons

### Pros

- clear service boundaries with independent deployment units
- high code reuse via shared packages (logger + TS config)
- consistent observability across services
- strongly typed env validation prevents bad startup configs
- reproducible Docker builds aligned with workspace pnpm version
- low-config new-service onboarding via scaffold script

### Cons / Tradeoffs

- gateway introduces an extra network hop and proxy complexity
- more infra overhead than a single-process monolith
- Docker builds still install full workspace in build stage (faster dev consistency, heavier build step)
- Docker builds use `pnpm deploy --prod --legacy` for stable workspace deploy behavior in CI/Docker
- adding a proxied domain service still needs gateway route/env updates

## Add A New Service (Low Config)

Generate a full service skeleton:

```bash
./scripts/add-service.sh <service-name> <port>
```

Example:

```bash
./scripts/add-service.sh billing 3003
```

This script creates:

- service source files (`src/index.ts`, `src/config/env.ts`, `src/routes/health.ts`, `src/lib/logger.ts`)
- service config (`package.json`, `tsconfig.json`, `docker/<service>.Dockerfile`)
- root `tsconfig.json` reference
- new service block in `docker/docker-compose.yml`

After generation:

```bash
pnpm install --no-frozen-lockfile
pnpm -r type-check
pnpm -r build
docker compose build <service-name>
```

If the service must be routed via gateway:

1. Add route in `services/gateway/src/proxy.ts`
2. Add service URL env fields in `services/gateway/src/config/env.ts`
3. Add required `env/.env` variables and map them in `docker/docker-compose.yml`

## Environment Conventions

Environment setup uses a single global env folder:

- all services read local config from `env/.env` (copy from `env/.env.example`)
- shared env is minimal (`NODE_ENV`, `LOG_LEVEL`, `LOG_FORMAT`, `LOG_HEALTHCHECKS`, shared network/database config, service ports)
- compose maps root `.env` values into container runtime env

## Health & Operations

- service health endpoint: `GET /health`
- gateway health endpoint: `GET /health`
- compose healthchecks use local service health routes
- default container user is non-root (`appuser`)
