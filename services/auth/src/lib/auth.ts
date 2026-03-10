import { getDB } from "@proptryx/database";
import { dash } from "@better-auth/infra";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI, organization } from "better-auth/plugins";
import { env } from "@/config/env";
import * as schema from "@proptryx/database";
import { logger } from "./logger";

const betterAuthUrl = env.BETTER_AUTH_URL;
const betterAuthSecret = env.BETTER_AUTH_SECRET;
const corsAllowedOrigins = env.CORS_ALLOWED_ORIGINS;
const trustedOrigins = Array.from(new Set([...corsAllowedOrigins, new URL(betterAuthUrl).origin]));

function resolveAuthDatabase() {
  try {
    return getDB();
  } catch {
    // Better Auth CLI imports this file before service boot; it only needs config shape.
    return {} as never;
  }
}

export const auth = betterAuth({
  appName: "Proptryx Auth Service",
  baseURL: betterAuthUrl,
  basePath: "/",
  secret: betterAuthSecret,
  trustedOrigins,
  database: drizzleAdapter(resolveAuthDatabase(), {
    provider: "pg",
    schema,
  }),
  onAPIError: {
    throw: true,
    onError: (error, _ctx) => {
      logger.error("Better Auth API error", {
        error: error instanceof Error ? error.stack : error,
      });
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  plugins: [
    openAPI({
      path: "/docs",
      nonce: env.BETTER_AUTH_SECRET,
      theme: "purple",
    }),
    dash({
      apiKey: env.BETTER_AUTH_API_KEY,
    }),
    organization(),
  ],
  emailVerification: {
    sendOnSignUp: false,
    autoSignInAfterVerification: true,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 200,
    customRules: {
      "/sign-in/email": {
        window: 60,
        max: 20,
      },
      "/sign-up/email": {
        window: 60,
        max: 20,
      },
    },
  },
  logger: {
    level: env.NODE_ENV === "development" ? "debug" : "info",
    disabled: false,
  },
  experimental: {
    joins: true,
  },
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for"],
    },
  },
});

export type BetterAuthInstance = typeof auth;
