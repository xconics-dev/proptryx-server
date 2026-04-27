import * as schema from "@proptryx/database";
import { and, eq, lte } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { resolveAuthDatabase } from "../../auth/utils";

const DISCOUNT_EXPIRY_CRON_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const DISCOUNT_EXPIRY_CRON_INITIAL_DELAY_MS = 5_000; // 5 seconds

let discountExpiryCronStarted = false;
let discountExpiryCronPromise: Promise<void> | null = null;

export async function deactivateExpiredDiscountPlans(now = new Date()) {
  const db = resolveAuthDatabase();

  const expiredPlans = await db
    .update(schema.subscriptionPlans)
    .set({
      isActive: false,
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.subscriptionPlans.isDeleted, false),
        eq(schema.subscriptionPlans.isActive, true),
        lte(schema.subscriptionPlans.discountAvailableTill, now)
      )
    )
    .returning({ id: schema.subscriptionPlans.id, code: schema.subscriptionPlans.code });

  if (expiredPlans.length > 0) {
    logger.info("expired discount subscription plans deactivated", {
      count: expiredPlans.length,
      planCodes: expiredPlans.map((plan) => plan.code),
    });
  }

  return expiredPlans;
}

function runDiscountExpiryCron() {
  if (discountExpiryCronPromise) {
    return;
  }

  discountExpiryCronPromise = deactivateExpiredDiscountPlans()
    .then(() => undefined)
    .catch((error) => {
      logger.error("expired discount subscription plan cron failed", {
        error: error instanceof Error ? error.stack : error,
      });
    })
    .finally(() => {
      discountExpiryCronPromise = null;
    });
}

export function startSubscriptionPlanDiscountExpiryCron() {
  if (discountExpiryCronStarted) {
    return;
  }

  discountExpiryCronStarted = true;

  const initialTimer = setTimeout(runDiscountExpiryCron, DISCOUNT_EXPIRY_CRON_INITIAL_DELAY_MS);
  initialTimer.unref?.();

  const intervalTimer = setInterval(runDiscountExpiryCron, DISCOUNT_EXPIRY_CRON_INTERVAL_MS);
  intervalTimer.unref?.();
}
