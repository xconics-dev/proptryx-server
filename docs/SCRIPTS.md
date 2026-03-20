# Scripts Reference

This file documents all `npm`/`pnpm` scripts currently defined in this monorepo.

## Root (`/package.json`)

Run from repo root with `pnpm <script>`.

| Script | Command | Purpose |
|---|---|---|
| `build` | `turbo run build` | Build all workspace packages/services that define `build`. |
| `build:gateway` | `turbo run build --filter=@proptryx/gateway` | Build only gateway service. |
| `build:auth` | `turbo run build --filter=@proptryx/auth` | Build only auth service. |
| `dev` | `pnpm --filter @proptryx/logger run build && turbo run dev --filter=@proptryx/gateway --filter=@proptryx/auth --filter=@proptryx/kernel` | Build logger once, then run all service dev servers. |
| `dev:gateway` | `turbo run dev --filter=@proptryx/gateway` | Run only gateway in dev mode. |
| `dev:auth` | `turbo run dev --filter=@proptryx/auth` | Run only auth in dev mode. |
| `lint` | `turbo run lint` | Lint all workspace targets. |
| `lint:fix` | `turbo run lint:fix` | Lint and auto-fix where supported. |
| `lint:gateway` | `turbo run lint --filter=@proptryx/gateway` | Lint only gateway. |
| `lint:auth` | `turbo run lint --filter=@proptryx/auth` | Lint only auth. |
| `type-check` | `turbo run type-check` | Run TypeScript checks across workspace. |
| `type-check:gateway` | `turbo run type-check --filter=@proptryx/gateway` | Type-check gateway only. |
| `type-check:auth` | `turbo run type-check --filter=@proptryx/auth` | Type-check auth only. |
| `clean` | `turbo run clean && rm -rf node_modules` | Clean all workspace outputs and remove root `node_modules`. |
| `clean:gateway` | `turbo run clean --filter=@proptryx/gateway` | Clean gateway outputs. |
| `clean:auth` | `turbo run clean --filter=@proptryx/auth` | Clean auth outputs. |
| `format` | `biome format --write .` | Format all supported files. |
| `format:check` | `biome format .` | Check formatting without writing. |
| `check` | `biome check .` | Run formatter+linter+imports checks. |
| `check:fix` | `biome check --write .` | Apply safe Biome fixes. |
| `docker:up` | `docker compose --env-file env/.env -f docker/docker-compose.yml up` | Run all services in foreground. |
| `docker:up:d` | `docker compose --env-file env/.env -f docker/docker-compose.yml up -d` | Run all services in detached mode. |
| `docker:down` | `docker compose --env-file env/.env -f docker/docker-compose.yml down` | Stop containers. |
| `docker:down:v` | `docker compose --env-file env/.env -f docker/docker-compose.yml down -v` | Stop containers and remove volumes. |
| `docker:logs` | `docker compose --env-file env/.env -f docker/docker-compose.yml logs -f` | Follow all container logs. |
| `docker:logs:gateway` | `docker compose --env-file env/.env -f docker/docker-compose.yml logs -f gateway` | Follow gateway logs. |
| `docker:logs:auth` | `docker compose --env-file env/.env -f docker/docker-compose.yml logs -f auth` | Follow auth logs. |
| `docker:ps` | `docker compose --env-file env/.env -f docker/docker-compose.yml ps` | Show running compose services. |
| `docker:build` | `docker compose --env-file env/.env -f docker/docker-compose.yml build` | Build compose images only. |
| `docker:prod:up` | `docker compose --env-file env/.env.prod -f docker/docker-compose.prod.yml up` | Run production compose in foreground. |
| `docker:prod:up:d` | `docker compose --env-file env/.env.prod -f docker/docker-compose.prod.yml up -d` | Run production compose in detached mode. |
| `docker:prod:up:build` | `docker compose --env-file env/.env.prod -f docker/docker-compose.prod.yml up --build` | Build and run production compose in foreground. |
| `docker:prod:up:build:d` | `docker compose --env-file env/.env.prod -f docker/docker-compose.prod.yml up --build -d` | Build and run production compose in detached mode. |
| `docker:prod:down` | `docker compose --env-file env/.env.prod -f docker/docker-compose.prod.yml down` | Stop production compose stack. |
| `docker:prod:logs` | `docker compose --env-file env/.env.prod -f docker/docker-compose.prod.yml logs -f` | Follow production compose logs. |
| `docker:prod:ps` | `docker compose --env-file env/.env.prod -f docker/docker-compose.prod.yml ps` | Show production compose service state. |
| `docker:size` | `bash scripts/docker-image-size.sh` | Show Docker image sizes (all or selected services). |
| `docker:size:build` | `bash scripts/docker-image-size.sh --build` | Build selected services first, then print image sizes. |
| `health:gateway` | `curl -s http://localhost:8000/health | jq` | Check gateway health endpoint. |
| `health:auth` | `curl -s http://localhost:8000/api/auth/health | jq` | Check auth health endpoint through gateway routing. |
| `prepare` | `husky` | Install/refresh Git hooks path on install. |
| `lint-staged` | `lint-staged` | Run staged-file quality checks (used by pre-commit hook). |
| `commitlint` | `commitlint` | Validate commit messages (used by commit-msg hook). |
| `deps:check` | `NO_UPDATE_NOTIFIER=1 ncu --workspaces --root` | Check available dependency updates across root and all workspaces. |
| `deps:bump` | `NO_UPDATE_NOTIFIER=1 ncu -u --workspaces --root && pnpm install --no-frozen-lockfile` | Bump dependency versions across root and workspaces, then refresh lockfile. |

## Service Scripts

These scripts are defined in:
- `services/gateway/package.json`
- `services/auth/package.json`
- `services/kernel/package.json`

Run with:
- `pnpm --filter @proptryx/<service> run <script>`

| Script | Command | Purpose |
|---|---|---|
| `build` | `tsup --config ../../tsup.config.ts` | Build service into `dist/`. |
| `dev` | `tsx watch --env-file=../../env/.env src/index.ts` | Start service in watch mode from global `env/.env`. |
| `start` | `node dist/index.js` | Run built output in production mode. |
| `lint` | `biome lint ./src` | Lint service source files. |
| `lint:fix` | `biome lint --write ./src` | Lint with auto-fixes. |
| `type-check` | `tsc --noEmit` | Type-check service code. |
| `clean` | `rm -rf dist .turbo` | Remove generated service artifacts. |

## Package Scripts

### `packages/logger/package.json`

Run with `pnpm --filter @proptryx/logger run <script>`.

| Script | Command | Purpose |
|---|---|---|
| `build` | `tsup --config ../../tsup.config.ts` | Build logger package output. |
| `lint` | `biome lint ./src` | Lint logger source. |
| `lint:fix` | `biome lint --write ./src` | Apply lint fixes in logger source. |
| `type-check` | `tsc --noEmit` | Type-check logger package. |
| `clean` | `rm -rf dist .turbo` | Remove logger artifacts. |

### `packages/typescript-config/package.json`

No scripts are currently defined.

## Git Hook Flow

- `pre-commit` hook: runs `pnpm lint-staged`
- `commit-msg` hook: runs `pnpm commitlint --edit "$1"`

This means every commit is checked for:
- Staged-file formatting/linting (Biome via lint-staged)
- Commit message format (Conventional Commits via Commitlint)

## Docker Size Selector Examples

Use service selectors: `gateway`, `auth`, `kernel`, or `all`.

```bash
pnpm docker:size
pnpm docker:size -- all
pnpm docker:size -- gateway auth
pnpm docker:size:build -- kernel
```
