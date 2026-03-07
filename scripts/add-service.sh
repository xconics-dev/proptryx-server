#!/usr/bin/env bash
set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "Usage: ./scripts/add-service.sh <service-name> <port>"
  exit 1
fi

SERVICE_NAME="$1"
PORT="$2"

if ! [[ "$SERVICE_NAME" =~ ^[a-z][a-z0-9-]*$ ]]; then
  echo "Service name must match: ^[a-z][a-z0-9-]*$"
  exit 1
fi

if ! [[ "$PORT" =~ ^[0-9]+$ ]] || [ "$PORT" -lt 1 ] || [ "$PORT" -gt 65535 ]; then
  echo "Port must be a number between 1 and 65535"
  exit 1
fi

SERVICE_DIR="services/${SERVICE_NAME}"

if [ -d "$SERVICE_DIR" ]; then
  echo "Service already exists: $SERVICE_DIR"
  exit 1
fi

mkdir -p "$SERVICE_DIR/src/config" "$SERVICE_DIR/src/lib" "$SERVICE_DIR/src/routes"

cat > "$SERVICE_DIR/package.json" <<EOF
{
  "name": "@proptryx/${SERVICE_NAME}",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsup --config ../../tsup.config.ts",
    "dev": "tsx watch --env-file=.env src/index.ts",
    "start": "node dist/index.js",
    "lint": "biome lint ./src",
    "lint:fix": "biome lint --write ./src",
    "type-check": "tsc --noEmit",
    "clean": "rm -rf dist .turbo"
  },
  "dependencies": {
    "@proptryx/logger": "workspace:*",
    "@hono/node-server": "^1.12.0",
    "@t3-oss/env-core": "^0.11.1",
    "hono": "^4.4.0",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@biomejs/biome": "^1.9.4",
    "@proptryx/typescript-config": "workspace:*",
    "@types/node": "^20.0.0",
    "tsup": "^8.3.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.3"
  }
}
EOF

cat > "$SERVICE_DIR/tsconfig.json" <<'EOF'
{
  "extends": "@proptryx/typescript-config/service.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "baseUrl": ".",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
EOF

cat > "$SERVICE_DIR/.env" <<EOF
# services/${SERVICE_NAME}/.env — copy: cp .env.example .env

NODE_ENV=development
PORT=${PORT}
LOG_LEVEL=info
LOG_FORMAT=pretty
EOF

cat > "$SERVICE_DIR/src/lib/logger.ts" <<EOF
import { createServiceLogger } from "@proptryx/logger";

export const logger = createServiceLogger("${SERVICE_NAME}");
EOF

cat > "$SERVICE_DIR/src/config/env.ts" <<EOF
import { logger } from "@/lib/logger";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),

    PORT: z.coerce
      .number({ invalid_type_error: "PORT must be a number" })
      .int()
      .min(1)
      .max(65535)
      .default(${PORT}),
    LOG_LEVEL: z
      .enum(["debug", "info", "warn", "error", "fatal"])
      .default("info"),
    LOG_FORMAT: z.enum(["pretty", "json"]).default("pretty"),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    LOG_LEVEL: process.env.LOG_LEVEL,
    LOG_FORMAT: process.env.LOG_FORMAT,
  },

  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",

  onValidationError(issues) {
    const normalizedIssues = Array.isArray(issues) ? issues : issues.errors;
    logger.fatal("invalid or missing environment variables");
    for (const issue of normalizedIssues) {
      logger.fatal("env validation issue", {
        path: issue.path.join("."),
        message: issue.message,
      });
    }
    logger.fatal("see environment example", {
      exampleFile: "services/${SERVICE_NAME}/.env.example",
    });
    process.exit(1);
  },
});
EOF

cat > "$SERVICE_DIR/src/routes/health.ts" <<EOF
import { Hono } from "hono";

const health = new Hono();

health.get("/", (c) =>
  c.json({
    success: true,
    service: "${SERVICE_NAME}",
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
);

export default health;
EOF

cat > "$SERVICE_DIR/src/index.ts" <<'EOF'
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import healthRoute from "@/routes/health";
import { createHonoRequestLogger } from "@proptryx/logger";
import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();
app.use("*", createHonoRequestLogger(logger));

app.route("/health", healthRoute);

app.notFound((c) =>
  c.json(
    {
      success: false,
      error: "Not Found",
      message: `${c.req.method} ${c.req.path} not found`,
    },
    404
  )
);

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  logger.info("service started", {
    port: info.port,
    baseUrl: `http://localhost:${info.port}`,
    healthPath: "/health",
  });
});

export default app;
EOF

cat > "$SERVICE_DIR/Dockerfile" <<EOF
# syntax=docker/dockerfile:1.7
# Build context: repo root (docker-compose.yml sets context: .)

FROM node:20-alpine AS base
WORKDIR /app
ENV PNPM_HOME="/pnpm"
ENV PATH="\$PNPM_HOME:\$PATH"
RUN corepack enable && corepack prepare pnpm@10.30.3 --activate

FROM base AS build-deps
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/logger/package.json ./packages/logger/package.json
COPY packages/typescript-config/package.json ./packages/typescript-config/package.json
COPY services/${SERVICE_NAME}/package.json ./services/${SERVICE_NAME}/package.json
RUN pnpm install --frozen-lockfile

FROM base AS builder
COPY --from=build-deps /app/node_modules /app/node_modules
COPY --from=build-deps /app/services/${SERVICE_NAME}/node_modules /app/services/${SERVICE_NAME}/node_modules
COPY tsup.config.ts /app/tsup.config.ts
COPY packages/logger /app/packages/logger
COPY packages/typescript-config /app/packages/typescript-config
COPY services/${SERVICE_NAME} /app/services/${SERVICE_NAME}
WORKDIR /app
RUN cd /app/packages/logger \\
 && /app/node_modules/.bin/tsup --config ../../tsup.config.ts \\
 && cd /app \\
 && SKIP_ENV_VALIDATION=true pnpm --filter @proptryx/${SERVICE_NAME} run build \\
 && pnpm --filter @proptryx/${SERVICE_NAME} deploy --prod --legacy /prod/${SERVICE_NAME}

FROM node:20-alpine AS runner
WORKDIR /app/services/${SERVICE_NAME}
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs \\
 && adduser --system --uid 1001 appuser
COPY --from=builder --chown=appuser:nodejs /prod/${SERVICE_NAME}/dist ./dist
COPY --from=builder --chown=appuser:nodejs /prod/${SERVICE_NAME}/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /prod/${SERVICE_NAME}/package.json ./package.json
USER appuser
EXPOSE ${PORT}
CMD ["node", "dist/index.js"]
EOF

node -e "
const fs = require('fs');
const path = 'tsconfig.json';
const config = JSON.parse(fs.readFileSync(path, 'utf8'));
config.references ||= [];
const refPath = './services/${SERVICE_NAME}';
if (!config.references.some((r) => r.path === refPath)) {
  config.references.push({ path: refPath });
}
fs.writeFileSync(path, JSON.stringify(config, null, 2) + '\n');
"

if ! grep -qE "^  ${SERVICE_NAME}:" docker-compose.yml; then
  awk -v s="${SERVICE_NAME}" -v p="${PORT}" '
    BEGIN {
      block = "  " s ":\n" \
              "    <<: *service-defaults\n" \
              "    build:\n" \
              "      context: .\n" \
              "      dockerfile: services/" s "/Dockerfile\n" \
              "    container_name: " s "\n" \
              "    ports:\n" \
              "      - \"" p ":" p "\"\n" \
              "    environment:\n" \
              "      <<: *service-env\n" \
              "      PORT: \"" p "\"\n" \
              "    healthcheck:\n" \
              "      test: [\"CMD\", \"wget\", \"-qO-\", \"http://localhost:" p "/health\"]\n" \
              "      interval: 10s\n" \
              "      timeout: 5s\n" \
              "      retries: 5\n" \
              "      start_period: 10s\n";
    }
    /^networks:/ && !done { printf "%s\n", block; done = 1 }
    { print }
  ' docker-compose.yml > docker-compose.yml.tmp
  mv docker-compose.yml.tmp docker-compose.yml
fi

echo "Created service: ${SERVICE_NAME}"
echo "Next:"
echo "  1) pnpm install --no-frozen-lockfile"
echo "  2) pnpm -r type-check && pnpm -r build"
echo "  3) docker compose build ${SERVICE_NAME}"
