# syntax=docker/dockerfile:1.7
# Build context: repo root (docker/docker-compose.yml sets context: .)

FROM node:20-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PNPM_STORE_DIR="/pnpm/store"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

FROM base AS build-deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/database/package.json ./packages/database/package.json
COPY packages/logger/package.json ./packages/logger/package.json
COPY packages/static/package.json ./packages/static/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json
COPY packages/utils/package.json ./packages/utils/package.json
COPY services/kernel/package.json ./services/kernel/package.json
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  pnpm install --frozen-lockfile --prefer-offline

FROM base AS builder
COPY --from=build-deps /app/node_modules /app/node_modules
COPY --from=build-deps /app/services/kernel/node_modules /app/services/kernel/node_modules
COPY tsup.config.ts /app/tsup.config.ts
COPY packages/database /app/packages/database
COPY packages/logger /app/packages/logger
COPY packages/static /app/packages/static
COPY packages/typescript-config /app/packages/typescript-config
COPY packages/utils /app/packages/utils
COPY services/kernel /app/services/kernel
WORKDIR /app
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
  cd /app/packages/logger \
  && /app/node_modules/.bin/tsup --config ../../tsup.config.ts \
  && cd /app/packages/database \
  && /app/node_modules/.bin/tsup --config ../../tsup.config.ts \
  && cd /app/packages/static \
  && /app/node_modules/.bin/tsup --config ../../tsup.config.ts \
  && cd /app/packages/utils \
  && /app/node_modules/.bin/tsup --config ../../tsup.config.ts \
  && cd /app \
  && SKIP_ENV_VALIDATION=true pnpm --filter @proptryx/kernel run build \
  && pnpm --filter @proptryx/kernel deploy --prod --legacy /prod/kernel

FROM gcr.io/distroless/nodejs20-debian12:nonroot AS runner
WORKDIR /app/services/kernel
COPY --from=builder --chown=65532:65532 /prod/kernel/dist ./dist
COPY --from=builder --chown=65532:65532 /prod/kernel/node_modules ./node_modules
COPY --from=builder --chown=65532:65532 /prod/kernel/package.json ./package.json
EXPOSE 6003
CMD ["dist/index.js"]