import type { BetterAuthPlugin } from "better-auth";
import { type UserFields, userFields } from "./fields/user";
import { rzClient } from "../razorpay/client";
import { razorpay } from "better-auth-razorpay";
import { env } from "@/config/env";

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

export const razorpayPlugin = razorpay({
  razorpayClient: rzClient,
  razorpayWebhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
  createCustomerOnSignUp: false,
  organization: {
    enabled: true,
  },
  subscription: {
    enabled: true,

    requireEmailVerification: false,
    plans: [
      {
        planId: "plan_SPPDk7LHo4Blma",
        name: "DUMMY",
      },
    ],
  },
}) as unknown as BetterAuthPlugin;
