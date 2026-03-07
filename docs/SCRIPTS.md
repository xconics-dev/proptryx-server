# Scripts Reference

This file documents all `npm`/`pnpm` scripts currently defined in this monorepo.

## Root (`/package.json`)

Run from repo root with `pnpm <script>`.

| Script | Command | Purpose |
|---|---|---|
| `build` | `turbo run build` | Build all workspace packages/services that define `build`. |
| `build:gateway` | `turbo run build --filter=@proptryx/gateway` | Build only gateway service. |
| `build:auth` | `turbo run build --filter=@proptryx/auth` | Build only auth service. |
| `build:property` | `turbo run build --filter=@proptryx/property` | Build only property service. |
| `dev` | `pnpm --filter @proptryx/logger run build && turbo run dev --filter=@proptryx/gateway --filter=@proptryx/auth --filter=@proptryx/property` | Build logger once, then run all service dev servers. |
| `dev:gateway` | `turbo run dev --filter=@proptryx/gateway` | Run only gateway in dev mode. |
| `dev:auth` | `turbo run dev --filter=@proptryx/auth` | Run only auth in dev mode. |
| `dev:property` | `turbo run dev --filter=@proptryx/property` | Run only property in dev mode. |
| `lint` | `turbo run lint` | Lint all workspace targets. |
| `lint:fix` | `turbo run lint:fix` | Lint and auto-fix where supported. |
| `lint:gateway` | `turbo run lint --filter=@proptryx/gateway` | Lint only gateway. |
| `lint:auth` | `turbo run lint --filter=@proptryx/auth` | Lint only auth. |
| `lint:property` | `turbo run lint --filter=@proptryx/property` | Lint only property. |
| `type-check` | `turbo run type-check` | Run TypeScript checks across workspace. |
| `type-check:gateway` | `turbo run type-check --filter=@proptryx/gateway` | Type-check gateway only. |
| `type-check:auth` | `turbo run type-check --filter=@proptryx/auth` | Type-check auth only. |
| `type-check:property` | `turbo run type-check --filter=@proptryx/property` | Type-check property only. |
| `clean` | `turbo run clean && rm -rf node_modules` | Clean all workspace outputs and remove root `node_modules`. |
| `clean:gateway` | `turbo run clean --filter=@proptryx/gateway` | Clean gateway outputs. |
| `clean:auth` | `turbo run clean --filter=@proptryx/auth` | Clean auth outputs. |
| `clean:property` | `turbo run clean --filter=@proptryx/property` | Clean property outputs. |
| `format` | `biome format --write .` | Format all supported files. |
| `format:check` | `biome format .` | Check formatting without writing. |
| `check` | `biome check .` | Run formatter+linter+imports checks. |
| `check:fix` | `biome check --write .` | Apply safe Biome fixes. |
| `docker:up` | `docker compose up --build` | Build and run all services in foreground. |
| `docker:up:d` | `docker compose up --build -d` | Build and run all services in detached mode. |
| `docker:down` | `docker compose down` | Stop containers. |
| `docker:down:v` | `docker compose down -v` | Stop containers and remove volumes. |
| `docker:logs` | `docker compose logs -f` | Follow all container logs. |
| `docker:logs:gateway` | `docker compose logs -f gateway` | Follow gateway logs. |
| `docker:logs:auth` | `docker compose logs -f auth` | Follow auth logs. |
| `docker:logs:property` | `docker compose logs -f property` | Follow property logs. |
| `docker:ps` | `docker compose ps` | Show running compose services. |
| `docker:build` | `docker compose build` | Build compose images only. |
| `docker:size` | `bash scripts/docker-image-size.sh` | Show Docker image sizes (all or selected services). |
| `docker:size:build` | `bash scripts/docker-image-size.sh --build` | Build selected services first, then print image sizes. |
| `health:gateway` | `curl -s http://localhost:3000/health | jq` | Check gateway health endpoint. |
| `health:auth` | `curl -s http://localhost:3000/api/auth/health | jq` | Check auth health endpoint through gateway routing. |
| `health:property` | `curl -s http://localhost:3000/api/property/health | jq` | Check property health endpoint through gateway routing. |
| `prepare` | `husky` | Install/refresh Git hooks path on install. |
| `lint-staged` | `lint-staged` | Run staged-file quality checks (used by pre-commit hook). |
| `commitlint` | `commitlint` | Validate commit messages (used by commit-msg hook). |
| `deps:check` | `NO_UPDATE_NOTIFIER=1 ncu --workspaces --root` | Check available dependency updates across root and all workspaces. |
| `deps:bump` | `NO_UPDATE_NOTIFIER=1 ncu -u --workspaces --root && pnpm install --no-frozen-lockfile` | Bump dependency versions across root and workspaces, then refresh lockfile. |

## Service Scripts

These scripts are defined in:
- `services/gateway/package.json`
- `services/auth/package.json`
- `services/property/package.json`

Run with:
- `pnpm --filter @proptryx/<service> run <script>`

| Script | Command | Purpose |
|---|---|---|
| `build` | `tsup --config ../../tsup.config.ts` | Build service into `dist/`. |
| `dev` | `tsx watch --env-file=.env src/index.ts` | Start service in watch mode with local `.env`. |
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

Use service selectors: `gateway`, `auth`, `property`, or `all`.

```bash
pnpm docker:size
pnpm docker:size -- all
pnpm docker:size -- gateway auth
pnpm docker:size:build -- property
```
