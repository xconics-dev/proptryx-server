# Dockploy Swarm Deployment (From GitHub)

This guide is the recommended way to deploy Proptryx on Dockploy with Swarm mode.

## 1. Files Used

- `docker/docker-compose.dockploy.yml` (Swarm stack file)
- `env/.env.dockploy.example` (required environment variables template)
- `.github/workflows/docker-publish.yml` (build/push images to GHCR)

## 2. Why This Setup

- Uses prebuilt images (faster + repeatable deploys)
- Uses Swarm-native `deploy` settings (replicas/resources/rolling updates)
- Uses Traefik labels in `deploy.labels` (correct for Swarm)
- Keeps app config in Dockploy env vars (no secrets in git)

## 3. GitHub Image Pipeline

Workflow: `.github/workflows/docker-publish.yml`

It publishes these images to GHCR on `main` push and tags:

- `ghcr.io/<owner>/proptryx-gateway:<tag>`
- `ghcr.io/<owner>/proptryx-auth:<tag>`
- `ghcr.io/<owner>/proptryx-property:<tag>`

### One-time prerequisites

1. In GitHub repo settings, ensure GitHub Actions has permission to write packages.
2. Ensure packages are visible to your Dockploy node (public or authenticated pull).

## 4. Dockploy Stack Setup

1. Create new stack in Dockploy.
2. Source: GitHub repository.
3. Branch: `main` (or release branch).
4. Compose file path: `docker/docker-compose.dockploy.yml`.
5. Enable Swarm mode deployment.
6. Add environment variables from `env/.env.dockploy.example`.
7. Replace image values with your GHCR owner/tag.

Required image envs:

- `GATEWAY_IMAGE`
- `AUTH_IMAGE`
- `PROPERTY_IMAGE`

Example:

- `GATEWAY_IMAGE=ghcr.io/acme/proptryx-gateway:main`
- `AUTH_IMAGE=ghcr.io/acme/proptryx-auth:main`
- `PROPERTY_IMAGE=ghcr.io/acme/proptryx-property:main`

## 5. Deploy Flow

1. Push code to GitHub.
2. Wait for `Docker Publish` workflow to complete.
3. In Dockploy, deploy/redeploy stack.
4. Verify all services are healthy.

## 6. Zero-Downtime Rollouts

Configured in compose:

- `update_config.order: start-first`
- `failure_action: rollback`
- per-service `healthcheck`

This gives safer rolling updates with automatic rollback behavior when updates fail.

## 7. Scale And Performance Tuning

Tune in Dockploy env values:

- Replicas: `GATEWAY_REPLICAS`, `AUTH_REPLICAS`, `PROPERTY_REPLICAS`
- CPU/memory limits and reservations: `*_CPU_*`, `*_MEM_*`
- Node heap settings: `*_NODE_OPTIONS`

Recommended start:

- `gateway=2 replicas`
- `auth=3 replicas`
- `property=3 replicas`

Then tune based on real CPU/memory/latency metrics.

## 8. Validation Checklist

- Gateway domain resolves correctly (`TRAEFIK_GATEWAY_HOST`)
- `https://<your-domain>/health` returns 200
- `https://<your-domain>/api/auth/health` returns 200
- `https://<your-domain>/api/property/health` returns 200
- No restart loop in Dockploy logs

## 9. Common Issues

1. Image pull denied
   - Fix GHCR visibility or registry credentials in Dockploy.
2. 404/502 at gateway
   - Verify Traefik host rule and entrypoint/cert resolver.
3. Service not scaling
   - Confirm Swarm mode is enabled for the stack.
4. Wrong version deployed
   - Pin image tags (e.g. `v1.2.3`) instead of `main`/`latest`.
