import { getDB } from "@proptryx/database";
import { dash } from "@better-auth/infra";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI, organization } from "better-auth/plugins";
import { env } from "@/config/env";
import * as schema from "@proptryx/database";

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
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  plugins: [
    openAPI({
      path: "/docs",
      nonce: env.BETTER_AUTH_SECRET,
    }),
    dash({
      apiKey: env.BETTER_AUTH_API_KEY,
    }),
    organization(),
  ],
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
