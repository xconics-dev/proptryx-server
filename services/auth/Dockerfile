# syntax=docker/dockerfile:1.7
# Build context: repo root (docker-compose.yml sets context: .)

FROM node:20-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

FROM base AS build-deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/logger/package.json ./packages/logger/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json
COPY services/auth/package.json ./services/auth/package.json
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=build-deps /app/node_modules /app/node_modules
COPY --from=build-deps /app/services/auth/node_modules /app/services/auth/node_modules
COPY tsup.config.ts /app/tsup.config.ts
COPY packages/logger /app/packages/logger
COPY packages/typescript-config /app/packages/typescript-config
COPY services/auth /app/services/auth
WORKDIR /app
RUN cd /app/packages/logger \
 && /app/node_modules/.bin/tsup --config ../../tsup.config.ts \
 && cd /app \
 && SKIP_ENV_VALIDATION=true pnpm --filter @proptryx/auth run build \
 && pnpm --filter @proptryx/auth deploy --prod --legacy /prod/auth

FROM node:20-alpine AS runner
WORKDIR /app/services/auth
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 appuser
COPY --from=builder --chown=appuser:nodejs /prod/auth/dist ./dist
COPY --from=builder --chown=appuser:nodejs /prod/auth/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /prod/auth/package.json ./package.json
USER appuser
EXPOSE 3001
CMD ["node", "dist/index.js"]
