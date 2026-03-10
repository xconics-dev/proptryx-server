import { getDB } from "@proptryx/database";
import { dash } from "@better-auth/infra";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, multiSession, openAPI, organization } from "better-auth/plugins";
import { env } from "@/config/env";
import * as schema from "@proptryx/database";
import { logger } from "./logger";

const betterAuthUrl = new URL(env.BETTER_AUTH_URL);
const betterAuthSecret = env.BETTER_AUTH_SECRET;
const corsAllowedOrigins = env.CORS_ALLOWED_ORIGINS;
const trustedOrigins = Array.from(new Set([...corsAllowedOrigins, betterAuthUrl.origin]));
const isProduction = env.NODE_ENV === "production";

function normalizeBasePath(pathname: string) {
  const normalizedPathname = pathname.trim().replace(/\/+$/, "");
  return normalizedPathname.length === 0 ? "/" : normalizedPathname;
}

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
  baseURL: betterAuthUrl.origin,
  basePath: normalizeBasePath(betterAuthUrl.pathname),
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
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // 24 hours
    deferSessionRefresh: true,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
      strategy: "compact",
    },
  },
  plugins: [
    bearer(),
    multiSession({
      maximumSessions: 1,
    }),
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
    level: !isProduction ? "debug" : "info",
    disabled: false,
  },
  experimental: {
    joins: true,
  },
  advanced: {
    defaultCookieAttributes: {
      sameSite: "lax",
      secure: isProduction,
      httpOnly: true,
      path: "/",
    },
    ipAddress: {
      ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
    },
  },
});

export type BetterAuthInstance = typeof auth;
