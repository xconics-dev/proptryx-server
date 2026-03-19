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
import { loadRbacCatalog } from "./rbac";
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
import {
  generateNextCompanyId,
  generateRandomId,
  generateUID,
  PasswordUtils,
} from "@proptryx/utils";
import { allowCustomInputFieldsPlugin, emailOtpGuardPlugin } from "./plugin";
import { rzClient } from "../razorpay/client";
import { desc, eq, like } from "drizzle-orm";

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
  const rbac = await loadRbacCatalog();

  // Resolve DB once — reuse across all hooks in this closure
  const db = resolveAuthDatabase();

  async function bootstrapOrganizationCustomer(params: {
    organizationId: string;
    memberId: string;
    ownerUserId: string;
    fallbackEmail?: string | null;
  }) {
    try {
      const [savedOrganization] = await db
        .select({
          id: schema.organization.id,
          name: schema.organization.name,
          email: schema.organization.email,
          phoneNumber: schema.organization.phoneNumber,
          gstNumber: schema.organization.gstNumber,
          razorpayCustomerId: schema.organization.razorpayCustomerId,
        })
        .from(schema.organization)
        .where(eq(schema.organization.id, params.organizationId))
        .limit(1);

      if (!savedOrganization) {
        logger.warn("Organization not found for Razorpay customer bootstrap", {
          organizationId: params.organizationId,
        });
        return;
      }

      if (savedOrganization.razorpayCustomerId) {
        return;
      }

      const email = savedOrganization.email || params.fallbackEmail || undefined;
      const phone = savedOrganization.phoneNumber || undefined;
      const gst = savedOrganization.gstNumber || undefined;

      let customerId: string | undefined;

      try {
        const customer = await rzClient.customers.create({
          name: savedOrganization.name,
          email,
          contact: phone,
          gstin: gst,
          notes: {
            organizationId: params.organizationId,
            memberId: params.memberId,
            ownerUserId: params.ownerUserId,
            createdAt: new Date().toISOString(),
          },
        });

        customerId = customer.id;
      } catch (createError) {
        if (email) {
          try {
            const customersResponse = await rzClient.customers.all({});
            customerId = customersResponse.items.find((customer) => customer.email === email)?.id;
          } catch (lookupError) {
            logger.warn("Failed to lookup existing Razorpay customer after create failure", {
              organizationId: params.organizationId,
              error: lookupError instanceof Error ? lookupError.stack : lookupError,
            });
          }
        }

        if (!customerId) {
          logger.error("Failed to create Razorpay customer for organization", {
            organizationId: params.organizationId,
            error: createError instanceof Error ? createError.stack : createError,
          });
          return;
        }
      }

      await db
        .update(schema.organization)
        .set({
          razorpayCustomerId: customerId,
        })
        .where(eq(schema.organization.id, params.organizationId));
    } catch (error) {
      logger.error("Failed to bootstrap Razorpay customer for organization", {
        organizationId: params.organizationId,
        error: error instanceof Error ? error.stack : error,
      });
    }
  }

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
      storeSessionInDatabase: false,
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
        creatorRole: rbac.defaultOrganizationRoleName,
        schema: {
          organization: { additionalFields: organizationAdditionalFields },
        },
        ac: rbac.organizationAccessControl,
        roles: rbac.organizationRoles,
        dynamicAccessControl: { enabled: true },
        organizationHooks: {
          beforeCreateOrganization: async ({ organization }) => {
            const [latestOrganization] = await db
              .select({ id: schema.organization.id })
              .from(schema.organization)
              .where(like(schema.organization.id, "PTCO%"))
              .orderBy(desc(schema.organization.createdAt))
              .limit(1);

            return {
              data: {
                ...organization,
                id: generateNextCompanyId(latestOrganization?.id),
              },
            };
          },
          afterCreateOrganization: async ({ organization, member, user }) => {
            void bootstrapOrganizationCustomer({
              organizationId: organization.id,
              memberId: member.id,
              ownerUserId: user.id,
              fallbackEmail: user.email,
            });
          },
        },
      }),
      organizationControlsPlugin,
      organizationSubscriptionPlugin,
      admin({
        defaultRole: rbac.defaultUserRoleName,
        adminRoles: rbac.adminRoleNames,
        ac: rbac.adminAccessControl,
        roles: rbac.adminRoles,
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
            data: { ...user, id: generateUID() },
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
  });
}

// ✅ Load rbac ONCE at startup — version stored, no double call
const initialRbac = await loadRbacCatalog();
let authVersion = initialRbac.version;
export let auth = await createAuthInstance();

export async function getAuth() {
  const nextRbac = await loadRbacCatalog();

  // ✅ Only recreate if RBAC version actually changed
  if (nextRbac.version !== authVersion) {
    auth = await createAuthInstance();
    authVersion = nextRbac.version;
  }

  return auth;
}

export type BetterAuthInstance = typeof auth;
