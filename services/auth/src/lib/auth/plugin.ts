import type { BetterAuthPlugin } from "better-auth";
import { APIError } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { eq } from "drizzle-orm";
import * as schema from "@proptryx/database";
import { type UserFields, userFields } from "./fields/user";
import { resolveAuthDatabase, resolveEmailExistsCache } from "./utils";

// ─────────────────────────────────────────────
// Allow Custom Input Fields Plugin
// ─────────────────────────────────────────────

export const allowCustomInputFieldsPlugin = {
  id: "allow-custom-input-fields",
  schema: {
    user: {
      fields: Array.isArray(userFields)
        ? Object.fromEntries(
            userFields.map((field: UserFields) => [
              field.name,
              {
                type: field.type,
                input: field.input,
                required: field.required,
                fieldName: field.fieldName,
              },
            ])
          )
        : userFields,
    },
  },
} satisfies BetterAuthPlugin;

// ─────────────────────────────────────────────
// Email OTP Guard Plugin
// ─────────────────────────────────────────────

// ✅ SELECT id LIMIT 1 — much faster than COUNT(*)
// ✅ Redis cache — skips DB entirely on repeat calls within TTL
async function assertEmailExists(email: string): Promise<void> {
  const cache = resolveEmailExistsCache();

  // 1️⃣ Redis first — O(1), no DB
  const cached = await cache.get(email);
  if (cached === "1") return;
  if (cached === "0") {
    throw new APIError("BAD_REQUEST", {
      message: "Email not registered. Please sign up first.",
    });
  }

  // 2️⃣ Cache miss — lightest possible DB query (unique index = single lookup)
  const [row] = await resolveAuthDatabase()
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.email, email))
    .limit(1);

  const exists = !!row;
  await cache.set(email, exists ? "1" : "0");

  if (!exists) {
    throw new APIError("BAD_REQUEST", {
      message: "Email not registered. Please sign up first.",
    });
  }
}

const EMAIL_MUST_EXIST_PATHS = new Set([
  "/email-otp/send-verification-otp",
  "/email-otp/check-verification-otp",
  "/email-otp/verify-email",
  "/sign-in/email-otp",
  "/email-otp/request-password-reset",
  "/forget-password/email-otp",
  "/email-otp/reset-password",
]);

const SESSION_GUARDED_PATHS = new Set([
  "/email-otp/request-email-change",
  "/email-otp/change-email",
]);

export const emailOtpGuardPlugin = {
  id: "email-otp-guard",
  hooks: {
    before: [
      {
        matcher: (ctx: { path?: string }) =>
          !!ctx.path &&
          (EMAIL_MUST_EXIST_PATHS.has(ctx.path) || SESSION_GUARDED_PATHS.has(ctx.path)),
        handler: createAuthMiddleware(async (ctx) => {
          // Session-guarded paths — Better Auth handles auth, skip email check
          if (SESSION_GUARDED_PATHS.has(ctx.path as string)) return;

          const email = (ctx.body as Record<string, string> | undefined)?.email;

          if (!email) {
            throw new APIError("BAD_REQUEST", {
              message: "Email is required.",
            });
          }

          await assertEmailExists(email);
        }),
      },
    ],
  },
} satisfies BetterAuthPlugin;
