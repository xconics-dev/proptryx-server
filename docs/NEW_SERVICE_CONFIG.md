## Add A New Service (Low Config)

Use the scaffold script:

```bash
./scripts/add-service.sh <service-name> <port>
```

Example:

```bash
./scripts/add-service.sh billing 3003
```

This creates and wires:

- `services/<service-name>/package.json`
- `services/<service-name>/tsconfig.json`
- `services/<service-name>/Dockerfile`
- `services/<service-name>/src/index.ts`
- `services/<service-name>/src/config/env.ts`
- `services/<service-name>/src/lib/logger.ts`
- `services/<service-name>/src/routes/health.ts`
- root `tsconfig.json` reference entry
- `docker/docker-compose.yml` service entry (same structure as auth/property)

After generation:

```bash
pnpm install --no-frozen-lockfile
pnpm -r type-check
pnpm -r build
docker compose build <service-name>
```

Run full stack:

```bash
docker compose up -d
docker compose ps
docker compose down
```

## If You Need Gateway Routing

If the new service must be reachable via gateway (`/api/<name>`), add one route entry in:

- `services/gateway/src/proxy.ts`

Example:

```ts
{ prefix: "/api/billing", target: env.BILLING_SERVICE_URL }
```

Then add env validation fields in:

- `services/gateway/src/config/env.ts`
- root `.env`
- `docker/docker-compose.yml` (`gateway.environment`)

## Docker Notes

- Service Dockerfiles are compatible with `pnpm@10.30.3`.
- Build flow compiles `@proptryx/logger` before each service build.
- Runtime image uses `pnpm deploy --prod --legacy` output for minimal runtime contents.
