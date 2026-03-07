# syntax=docker/dockerfile:1.7
# Build context: repo root (docker-compose.yml sets context: .)

FROM node:20-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PNPM_STORE_DIR="/pnpm/store"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

FROM base AS build-deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/logger/package.json ./packages/logger/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json
COPY services/gateway/package.json ./services/gateway/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --prefer-offline

FROM base AS builder
COPY --from=build-deps /app/node_modules /app/node_modules
COPY --from=build-deps /app/services/gateway/node_modules /app/services/gateway/node_modules
COPY tsup.config.ts /app/tsup.config.ts
COPY packages/logger /app/packages/logger
COPY packages/typescript-config /app/packages/typescript-config
COPY services/gateway /app/services/gateway
WORKDIR /app
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  cd /app/packages/logger \
  && /app/node_modules/.bin/tsup --config ../../tsup.config.ts \
  && cd /app \
  && SKIP_ENV_VALIDATION=true pnpm --filter @proptryx/gateway run build \
  && pnpm --filter @proptryx/gateway deploy --prod --legacy /prod/gateway

FROM gcr.io/distroless/nodejs20-debian12:nonroot AS runner
WORKDIR /app/services/gateway
ENV NODE_ENV=production
COPY --from=builder --chown=65532:65532 /prod/gateway/dist ./dist
COPY --from=builder --chown=65532:65532 /prod/gateway/node_modules ./node_modules
COPY --from=builder --chown=65532:65532 /prod/gateway/package.json ./package.json
EXPOSE 3000
CMD ["dist/index.js"]
