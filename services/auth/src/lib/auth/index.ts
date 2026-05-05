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
  resolveAuthUserStatusCache,
  resolveAuthDatabase,
  resolveAuthSecondaryStorage,
  resolveUserZone,
} from "./utils";
import { organizationSubscriptionPlugin, subscriptionPlansPlugin } from "../razorpay/subscriptions";
import { organizationControlsPlugin } from "./organization";
import { generateRandomId, generateUID, PasswordUtils } from "@proptryx/utils";
import { allowCustomInputFieldsPlugin, emailOtpGuardPlugin } from "./plugin";
import { and, eq, isNull } from "drizzle-orm";
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

// ─────────────────────────────────────────────
// Auth instance factory
// ─────────────────────────────────────────────

async function createAuthInstance() {
  // Resolve DB once — reuse across all hooks in this closure
  const db = resolveAuthDatabase();
  const userStatusCache = resolveAuthUserStatusCache();

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
        requireEmailVerificationOnInvitation: false,
        schema: {
          organization: { additionalFields: organizationAdditionalFields },
        },
      }),
      organizationControlsPlugin,
      subscriptionPlansPlugin,
      organizationSubscriptionPlugin,
      admin({
        defaultRole: "user",
      }),
      allowCustomInputFieldsPlugin,
      customSession(async ({ session, user }) => {
        const sessionWithOrganization = session as typeof session & {
          activeOrganizationId?: string | null;
        };
        const sessionUser = user as typeof user & {
          banned?: boolean | null;
          banReason?: string | null;
          role?: string | null;
          panel?: string | null;
          zoneId?: string | null;
        };

        const cachedUser = await userStatusCache.get(sessionUser.id);

        const liveUser =
          cachedUser ??
          (await (async () => {
            const [dbUser] = await db
              .select({
                id: schema.user.id,
                banned: schema.user.banned,
                banReason: schema.user.banReason,
                role: schema.user.role,
                panel: schema.user.panel,
                zoneId: schema.user.zoneId,
                updatedAt: schema.user.updatedAt,
              })
              .from(schema.user)
              .where(eq(schema.user.id, sessionUser.id))
              .limit(1);

            if (!dbUser) {
              return null;
            }

            const nextCachedUser = {
              id: dbUser.id,
              banned: Boolean(dbUser.banned),
              banReason: dbUser.banReason,
              role: dbUser.role,
              panel: dbUser.panel,
              zoneId: dbUser.zoneId,
              updatedAt: dbUser.updatedAt.toISOString(),
            };

            await userStatusCache.set(sessionUser.id, nextCachedUser);
            return nextCachedUser;
          })());

        if (!liveUser) {
          throw new APIError("UNAUTHORIZED", {
            message: "Session user not found.",
          });
        }

        if (liveUser?.banned) {
          throw new APIError("FORBIDDEN", {
            message: liveUser.banReason ?? "Your account has been banned.",
          });
        }

        const userWithTags = {
          ...sessionUser,
          banned: liveUser?.banned ?? sessionUser.banned,
          banReason: liveUser?.banReason ?? sessionUser.banReason,
          role: liveUser?.role ?? sessionUser.role,
          panel: liveUser?.panel ?? sessionUser.panel,
          zoneId: liveUser?.zoneId ?? sessionUser.zoneId,
        };

        const location = await resolveUserZone(userWithTags.zoneId);
        const activeOrganizationId =
          typeof sessionWithOrganization.activeOrganizationId === "string"
            ? sessionWithOrganization.activeOrganizationId
            : null;
        const [activeMember] = activeOrganizationId
          ? await db
              .select({
                role: schema.member.role,
                panel: schema.member.panel,
                organizationId: schema.member.organizationId,
              })
              .from(schema.member)
              .where(
                and(
                  eq(schema.member.userId, sessionUser.id),
                  eq(schema.member.organizationId, activeOrganizationId)
                )
              )
              .limit(1)
          : [];
        const resolvedRole = activeMember?.role ?? userWithTags.role ?? null;
        const resolvedPanel = activeMember?.panel ?? userWithTags.panel ?? null;
        const [roleRecord] = resolvedRole
          ? await db
              .select({
                id: schema.rbacRole.id,
                panel: schema.rbacRole.panel,
              })
              .from(schema.rbacRole)
              .where(
                activeMember
                  ? and(
                      eq(schema.rbacRole.panel, "company"),
                      eq(schema.rbacRole.slug, resolvedRole),
                      eq(
                        schema.rbacRole.organizationId,
                        activeMember.organizationId ?? activeOrganizationId
                      )
                    )
                  : and(
                      eq(schema.rbacRole.panel, "proptryx"),
                      eq(schema.rbacRole.slug, resolvedRole),
                      isNull(schema.rbacRole.organizationId)
                    )
              )
              .limit(1)
          : [];
        const permissionRows = roleRecord
          ? await db
              .select({
                resource: schema.rbacRolePermission.resource,
                accessLevel: schema.rbacRolePermission.accessLevel,
                actions: schema.rbacRolePermission.actions,
              })
              .from(schema.rbacRolePermission)
              .where(eq(schema.rbacRolePermission.roleId, roleRecord.id))
          : [];

        return {
          session: sessionWithOrganization,
          user: {
            ...userWithTags,
            zone: location.zone?.name,
            region: location.region?.name,
            updatedAt: new Date(liveUser.updatedAt),
          },
          authorization: {
            panel: roleRecord?.panel ?? resolvedPanel,
            role: resolvedRole,
            roleId: roleRecord?.id ?? null,
            permissions: Object.fromEntries(
              permissionRows.map((permissionRow) => [
                permissionRow.resource,
                {
                  accessLevel: permissionRow.accessLevel,
                  actions: permissionRow.actions ?? {},
                },
              ])
            ),
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
        update: {
          after: async (user) => {
            await userStatusCache.del(user.id);
          },
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
        const path = ctx.path;
        const returned = ctx.context.returned;
        const isAuthPath =
          path === "/sign-in/email" ||
          path === "/sign-up/email" ||
          path === "/sign-in/email-otp" ||
          path === "/two-factor/verify-otp" ||
          path === "/two-factor/verify-totp";

        if (
          isAuthPath &&
          returned &&
          typeof returned === "object" &&
          "user" in returned &&
          returned.user &&
          typeof returned.user === "object" &&
          "id" in returned.user
        ) {
          const userId = returned.user.id as string;

          const [user] = await db
            .select({
              id: schema.user.id,
              email: schema.user.email,
              role: schema.user.role,
              emailVerified: schema.user.emailVerified,
              memberId: schema.member.id,
              banned: schema.user.banned,
              ban: schema.user.banReason,
              zoneId: schema.user.zoneId,
              panel: schema.user.panel,
            })
            .from(schema.user)
            .leftJoin(schema.member, eq(schema.user.id, schema.member.userId))
            .where(eq(schema.user.id, userId))
            .limit(1);

          if (user) {
            returned.user = {
              ...user,
              hasOrganization: !!user.memberId,
            };
          }
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
