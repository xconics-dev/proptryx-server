/** biome-ignore-all lint/suspicious/noExplicitAny: forced */
import { dash } from "@better-auth/infra";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { customSession, openAPI, phoneNumber } from "better-auth/plugins";
import { admin } from "better-auth/plugins/admin";
import { bearer } from "better-auth/plugins/bearer";
import { multiSession } from "better-auth/plugins/multi-session";
import { organization } from "better-auth/plugins/organization";
import * as schema from "@proptryx/database";
import { env } from "@/config/env";
import { logger } from "@/lib/logger";
import { loadRbacCatalog } from "./rbac";
import {
  getBetterAuthConfigState,
  normalizeBasePath,
  organizationAdditionalFields,
  resolveAuthDatabase,
  resolveAuthSecondaryStorage,
  resolveUserLocation,
} from "./utils";
import {
  generateNextCompanyId,
  generateRandomId,
  generateUID,
  PasswordUtils,
} from "@proptryx/utils";
import { allowCustomInputFieldsPlugin } from "./plugin";
import { rzClient } from "../razorpay/client";
import { eq } from "drizzle-orm";

const {
  betterAuthSecret,
  betterAuthUrl,
  betterAuthAllowedHosts,
  crossSubDomainCookies,
  isProduction,
  trustedOrigins,
} = getBetterAuthConfigState();

async function createAuthInstance() {
  const rbac = await loadRbacCatalog();

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
      password: {
        hash: async (password) => await PasswordUtils.hash(password),
        verify: async ({ password, hash }) => await PasswordUtils.verify(password, hash),
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
        maxAge: 60 * 5, // 5 minutes
        strategy: "jwe",
      },
    },
    verification: {
      storeInDatabase: false,
    },
    plugins: [
      bearer(),
      phoneNumber({
        expiresIn: 60 * 5, // 5 minutes
        requireVerification: false,
        allowedAttempts: 5, // 5 attempts
        sendOTP: ({ phoneNumber, code }, ctx) => {
          // Implement sending OTP code via SMS
          logger.info("Sending OTP", {
            phoneNumber,
            code,
            context: ctx,
          });
        },
        callbackOnVerification: async ({ phoneNumber, user }, ctx) => {
          // Implement any logic after successful phone verification
          logger.info("Phone number verified", {
            phoneNumber,
            userId: user.id,
            context: ctx,
          });
        },
      }),
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
      organization({
        organizationLimit: 10,
        creatorRole: rbac.defaultOrganizationRoleName,
        schema: {
          organization: {
            additionalFields: organizationAdditionalFields,
          },
        },
        ac: rbac.organizationAccessControl,
        roles: rbac.organizationRoles,
        dynamicAccessControl: {
          enabled: true,
        },
        organizationHooks: {
          beforeCreateOrganization: async ({ organization }) => {
            return {
              data: {
                ...organization,
                id: generateNextCompanyId(),
              },
            };
          },
          afterCreateOrganization: async ({ organization, member, user }) => {
            const userWithTags = user as typeof user & {
              phoneNumber?: string | null;
            };

            const email = user.email;
            const phone = userWithTags.phoneNumber || undefined;
            const gst = organization.gstNumber || undefined;

            let existingCustomer: any = null;

            // 1️⃣ Fetch customers by email ONLY
            const customersResponse = await rzClient.customers.all({});

            if (customersResponse.items.length > 0) {
              // 2️⃣ Pick first match (email is primary identity)
              existingCustomer = customersResponse.items[0];
            }

            let customerId: string;

            if (existingCustomer) {
              customerId = existingCustomer.id;

              // 3️⃣ Update existing customer if data missing
              const shouldUpdate = phone && !existingCustomer.contact;

              if (shouldUpdate) {
                await rzClient.customers.edit(existingCustomer.id, {
                  contact: phone || existingCustomer.contact,
                });
              }
            } else {
              // 4️⃣ Create new customer
              const customer = await rzClient.customers.create({
                name: user.name,
                email,
                contact: phone,
                gstin: gst,
                notes: {
                  organizationId: organization.id,
                  memberId: member.id,
                  userId: user.id,
                  createdAt: new Date().toISOString(),
                },
              });

              customerId = customer.id;
            }

            // 5️⃣ Save customer ID in organization
            await resolveAuthDatabase()
              .update(schema.organization)
              .set({
                razorpayCustomerId: customerId,
              })
              .where(eq(schema.organization.id, organization.id));
          },
        },
      }),
      admin({
        defaultRole: rbac.defaultUserRoleName,
        adminRoles: rbac.adminRoleNames,
        ac: rbac.adminAccessControl,
        roles: rbac.adminRoles,
      }),
      allowCustomInputFieldsPlugin,
      customSession(async ({ session, user }) => {
        const userWithTags = user as typeof user & {
          zoneId?: string | null;
        };
        const location = await resolveUserLocation(userWithTags.zoneId);

        return {
          session,
          user: {
            ...userWithTags,
            zone: location.zone?.name,
            region: location.region?.name,
          },
        };
      }),

      // Razorpay Plugin for subscription management and payment processing
    ],
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
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
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            return {
              data: {
                ...user,
                id: generateUID(),
              },
            };
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
      database: {
        generateId: () => generateRandomId(),
      },
      ipAddress: {
        ipAddressHeaders: ["x-forwarded-for", "x-real-ip"],
      },
    },
  });
}

let authVersion = "";
export let auth = await createAuthInstance();

export async function getAuth() {
  const nextRbac = await loadRbacCatalog();

  if (nextRbac.version !== authVersion) {
    auth = await createAuthInstance();
    authVersion = nextRbac.version;
  }

  return auth;
}

authVersion = (await loadRbacCatalog()).version;

export type BetterAuthInstance = typeof auth;
