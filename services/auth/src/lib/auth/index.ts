/** biome-ignore-all lint/suspicious/noExplicitAny: forced */
import { dash } from "@better-auth/infra";
import { APIError, betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { customSession, emailOTP, openAPI, phoneNumber } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";
import { bearer } from "better-auth/plugins/bearer";
import { multiSession } from "better-auth/plugins/multi-session";
import { organization } from "better-auth/plugins/organization";
import * as schema from "@proptryx/database";
import {
  renderSignInCodeEmail,
  renderPasswordResetOtpEmail,
  sendEmail,
  emailSubject,
} from "@proptryx/notification";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import {
  getBetterAuthConfigState,
  normalizeBasePath,
  organizationAdditionalFields,
  resolveAuthDatabase,
  resolveAuthSecondaryStorage,
  resolveUserZone,
} from "./utils";
import { organizationSubscriptionPlugin } from "../razorpay/subscription";
import { organizationControlsPlugin } from "./organization";
import { ensureDefaultOrganizationRoles } from "./rbac";
import { generateRandomId, generateUID, PasswordUtils } from "@proptryx/utils";
import { allowCustomInputFieldsPlugin, emailOtpGuardPlugin } from "./plugin";
import { eq } from "drizzle-orm";
import { createAuthMiddleware } from "better-auth/api";

// ─────────────────────────────────────────────
// Config — resolved once at module load
// ─────────────────────────────────────────────

const {
  betterAuthSecret,
  betterAuthUrl,
  betterAuthAllowedHosts,
  crossSubDomainCookies,
  isProduction,
  trustedOrigins,
} = getBetterAuthConfigState();

const AUTH_RESPONSE_ENRICH_PATHS = new Set([
  "/sign-in/email",
  "/sign-up/email",
  "/sign-in/email-otp",
  "/two-factor/verify-otp",
  "/two-factor/verify-totp",
]);

function getReturnedUserId(returned: unknown): string | null {
  if (!returned || typeof returned !== "object" || !("user" in returned)) {
    return null;
  }

  const maybeUser = returned.user;
  if (!maybeUser || typeof maybeUser !== "object" || !("id" in maybeUser)) {
    return null;
  }

  return typeof maybeUser.id === "string" ? maybeUser.id : null;
}

// ─────────────────────────────────────────────
// Auth instance factory
// ─────────────────────────────────────────────

async function createAuthInstance() {
  // Resolve DB once — reuse across all hooks in this closure
  const db = resolveAuthDatabase();

  return betterAuth({
    appName: "Proptryx Auth Service",
    baseURL: isProduction
      ? {
          allowedHosts: betterAuthAllowedHosts,
          fallback: betterAuthUrl.origin,
          protocol: "https",
        }
      : betterAuthUrl.origin,
    basePath: normalizeBasePath(betterAuthUrl.pathname),
    secret: betterAuthSecret,
    trustedProxyHeaders: isProduction,
    trustedOrigins,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema,
    }),
    secondaryStorage: resolveAuthSecondaryStorage(),
    onAPIError: {
      throw: true,
      onError: (error) => {
        logger.error("Proptryx Auth Service API", {
          error: error instanceof Error ? error.stack : error,
        });

        if (error instanceof APIError) throw error;

        throw new APIError("INTERNAL_SERVER_ERROR", {
          message: "Something went wrong",
        });
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      password: {
        hash: (password) => PasswordUtils.hash(password),
        verify: ({ password, hash }) => PasswordUtils.verify(password, hash),
      },
    },
    emailVerification: {
      sendOnSignUp: false,
      autoSignInAfterVerification: true,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30, // 30 days
      updateAge: 60 * 60 * 24, // 24 hours
      deferSessionRefresh: true,
      storeSessionInDatabase: true,
      cookieCache: {
        enabled: false,
        maxAge: 60 * 5,
        strategy: "jwe",
      },
    },
    verification: {
      storeInDatabase: false,
    },
    plugins: [
      bearer(),
      phoneNumber({
        expiresIn: 60 * 5,
        requireVerification: false,
        allowedAttempts: 5,
        sendOTP: ({ phoneNumber, code }) => {
          logger.info("Sending OTP", { phoneNumber, code });
        },
        callbackOnVerification: async ({ phoneNumber, user }) => {
          logger.info("Phone number verified", {
            phoneNumber,
            userId: user.id,
          });
        },
      }),
      multiSession({ maximumSessions: 1 }),
      openAPI({
        path: "/docs",
        nonce: env.BETTER_AUTH_SECRET,
        theme: "purple",
      }),
      dash({ apiKey: env.BETTER_AUTH_API_KEY }),
      organization({
        organizationLimit: 10,
        schema: {
          organization: { additionalFields: organizationAdditionalFields },
        },
        organizationHooks: {
          afterCreateOrganization: async ({ organization }) => {
            await ensureDefaultOrganizationRoles(db, organization.id);
          },
        },
      }),
      organizationControlsPlugin,
      organizationSubscriptionPlugin,
      admin({
        defaultRole: "user",
      }),
      allowCustomInputFieldsPlugin,
      customSession(async ({ session, user }) => {
        const userWithTags = user as typeof user & { zoneId?: string | null };
        const location = await resolveUserZone(userWithTags.zoneId);

        return {
          session,
          user: {
            ...userWithTags,
            zone: location.zone?.name,
            region: location.region?.name,
          },
        };
      }),
      // ✅ Guard runs before emailOTP — intercepts before plugin swallows errors
      emailOtpGuardPlugin,
      emailOTP({
        expiresIn: 60 * 10, // 10 minutes
        allowedAttempts: 5,
        storeOTP: "hashed",
        overrideDefaultEmailVerification: false,
        async sendVerificationOTP({ email, otp, type }) {
          if (type === "sign-in") {
            await sendEmail({
              to: email,
              subject: emailSubject["sign-in"].subject,
              html: await renderSignInCodeEmail({
                otpCode: otp,
                previewText: emailSubject["sign-in"].previewText,
              }),
            });
          }

          if (type === "forget-password") {
            await sendEmail({
              to: email,
              subject: emailSubject["forget-password"].subject,
              html: await renderPasswordResetOtpEmail({
                otpCode: otp,
                previewText: emailSubject["forget-password"].previewText,
              }),
            });
          }
        },
      }),
    ],
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        "/sign-in/email": { window: 60, max: 20 },
        "/sign-up/email": { window: 60, max: 20 },
        "/email-otp/send-verification-otp": { window: 60, max: 10 },
        "/sign-in/email-otp": { window: 60, max: 10 },
        "/email-otp/request-password-reset": { window: 60, max: 10 },
        "/forget-password/email-otp": { window: 60, max: 10 },
      },
    },
    logger: {
      level: isProduction ? "info" : "debug",
      disabled: false,
    },
    experimental: { joins: true },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => ({
            data: {
              ...user,
              id: generateUID(),
              panel: user.panel ?? null,
              role: user.role ?? "user",
            },
          }),
        },
      },
    },
    advanced: {
      crossSubDomainCookies,
      defaultCookieAttributes: {
        sameSite: "lax",
        secure: isProduction,
        httpOnly: true,
        path: "/",
      },
      database: { generateId: () => generateRandomId() },
      ipAddress: {
        ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
      },
    },
    hooks: {
      // Enhance the returned user object
      after: createAuthMiddleware(async (ctx) => {
        if (!AUTH_RESPONSE_ENRICH_PATHS.has(ctx.path)) {
          return ctx.context.returned;
        }

        const returned = ctx.context.returned;
        const userId = getReturnedUserId(returned);

        if (!userId) {
          return returned;
        }

        try {
          const [userRows, membershipRows] = await Promise.all([
            db
              .select({
                id: schema.user.id,
                name: schema.user.name,
                email: schema.user.email,
                role: schema.user.role,
                emailVerified: schema.user.emailVerified,
                banned: schema.user.banned,
                banReason: schema.user.banReason,
                zoneId: schema.user.zoneId,
                panel: schema.user.panel,
              })
              .from(schema.user)
              .where(eq(schema.user.id, userId))
              .limit(1),
            db
              .select({ id: schema.member.id })
              .from(schema.member)
              .where(eq(schema.member.userId, userId))
              .limit(1),
          ]);

          const user = userRows[0];
          const membership = membershipRows[0];

          if (user && returned && typeof returned === "object") {
            (returned as { user?: unknown }).user = {
              ...user,
              hasOrganization: Boolean(membership),
            };
          }
        } catch (error) {
          logger.warn("Skipping auth response enrichment", {
            path: ctx.path,
            userId,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        return returned;
      }),
    },
  });
}

let authInstance: BetterAuthInstance | null = null;
let authInitializationPromise: Promise<BetterAuthInstance> | null = null;

async function initializeAuthInstance(): Promise<BetterAuthInstance> {
  if (authInstance) {
    return authInstance;
  }

  if (authInitializationPromise) {
    return authInitializationPromise;
  }

  authInitializationPromise = (async () => {
    const nextAuthInstance = await createAuthInstance();
    authInstance = nextAuthInstance;
    return nextAuthInstance;
  })();

  try {
    return await authInitializationPromise;
  } finally {
    authInitializationPromise = null;
  }
}

export async function warmAuth() {
  await initializeAuthInstance();
}

export async function getAuth() {
  return initializeAuthInstance();
}

export type BetterAuthInstance = Awaited<ReturnType<typeof createAuthInstance>>;
