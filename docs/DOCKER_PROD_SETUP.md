# Docker Production Setup

This guide explains the new Docker setup for performance, scalability, and safer production defaults.

## 1. Env Files

- `env/.env` is for local development (`docker/docker-compose.yml`).
- `env/.env.prod` is for production (`docker/docker-compose.prod.yml`).
- `env/.env.prod` is git-ignored by default, so keep real secrets there.

## 2. Production Architecture

`docker/docker-compose.prod.yml` uses:

- `gateway` as the only public entrypoint
- internal-only `auth` and `kernel` services (via `expose`, not host ports)
- Traefik labels on `gateway`
- service health checks and dependency health gating
- per-service resource limits/reservations
- replica controls for horizontal scaling

## 3. Security Hardening

Prod services are configured with:

- `read_only: true`
- `tmpfs: /tmp`
- `cap_drop: [ALL]`
- `security_opt: [no-new-privileges:true]`
- `init: true`

These settings reduce container attack surface and improve runtime behavior.

## 4. Performance / Scale Knobs

Tune in `env/.env.prod`:

- replicas:
  - `GATEWAY_REPLICAS`
  - `AUTH_REPLICAS`
  - `KERNEL_REPLICAS`
- CPU/memory limits and reservations:
  - `*_CPU_LIMIT`, `*_MEM_LIMIT`
  - `*_CPU_RESERVATION`, `*_MEM_RESERVATION`
- Node runtime heap:
  - `*_NODE_OPTIONS` (example: `--max-old-space-size=768`)
- log retention:
  - `DOCKER_LOG_MAX_SIZE`
  - `DOCKER_LOG_MAX_FILE`

## 5. Run Commands

Build + run prod stack:

```bash
pnpm docker:prod:up:build:d
```

Inspect:

```bash
pnpm docker:prod:ps
pnpm docker:prod:logs
```

Stop:

```bash
pnpm docker:prod:down
```

## 6. Load Balancing Notes

- Replicas are effective in Docker Swarm mode (`deploy.replicas`).
- In plain Docker Compose mode, `deploy` is mostly ignored.
- For non-Swarm horizontal scale, use an orchestrator (Swarm/Kubernetes) or manually run multiple instances behind Traefik.

## 7. Recommended Rollout Flow

1. Update `env/.env.prod`.
2. Validate compose config:
   - `docker compose --env-file env/.env.prod -f docker/docker-compose.prod.yml config`
3. Deploy:
   - `pnpm docker:prod:up:build:d`
4. Verify:
   - `pnpm docker:prod:ps`
   - `pnpm docker:prod:logs`
