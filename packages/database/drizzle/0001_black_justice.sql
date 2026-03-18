DROP INDEX "subscription_plans_razorpayAnnualPlanId_uidx";--> statement-breakpoint
ALTER TABLE "subscription_plans" DROP COLUMN "razorpay_annual_plan_id";