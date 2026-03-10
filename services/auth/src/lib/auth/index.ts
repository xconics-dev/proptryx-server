import { dash } from "@better-auth/infra";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer, multiSession, openAPI, organization } from "better-auth/plugins";
import * as schema from "@proptryx/database";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import {
  getBetterAuthConfigState,
  normalizeBasePath,
  resolveAuthDatabase,
  resolveAuthSecondaryStorage,
} from "./utils";

const { betterAuthSecret, betterAuthUrl, isProduction, trustedOrigins } =
  getBetterAuthConfigState();

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
  secondaryStorage: resolveAuthSecondaryStorage(),
  onAPIError: {
    throw: true,
    onError: (error, _ctx) => {
      logger.error("Proptryx Auth Service API", {
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
    storeSessionInDatabase: false,
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
      strategy: "jwe",
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
