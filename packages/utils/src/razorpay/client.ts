import Razorpay from "razorpay";
import { z } from "zod";

const razorpayEnvSchema = z.object({
  RAZORPAY_KEY_ID: z.string().min(1, "RAZORPAY_KEY_ID is required for Razorpay integration"),
  RAZORPAY_KEY_SECRET: z
    .string()
    .min(1, "RAZORPAY_KEY_SECRET is required for Razorpay integration"),
});

let razorpayClient: Razorpay | null = null;

function resolveRazorpayConfig() {
  return razorpayEnvSchema.parse({
    RAZORPAY_KEY_ID: process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: process.env.RAZORPAY_KEY_SECRET,
  });
}

function createRazorpayClient() {
  const config = resolveRazorpayConfig();

  return new Razorpay({
    key_id: config.RAZORPAY_KEY_ID,
    key_secret: config.RAZORPAY_KEY_SECRET,
  });
}

export function getRazorpayClient() {
  if (razorpayClient) {
    return razorpayClient;
  }

  razorpayClient = createRazorpayClient();
  return razorpayClient;
}

export function initializeRazorpayClient() {
  return getRazorpayClient();
}

export function resetRazorpayClient() {
  razorpayClient = null;
}
