ALTER TABLE "subscription_plans" DROP CONSTRAINT "subscription_plans_code_unique";--> statement-breakpoint
DROP INDEX "subscription_plans_isActive_idx";--> statement-breakpoint
DROP INDEX "subscription_plans_code_uidx";--> statement-breakpoint
DROP INDEX "subscription_plans_razorpayPlanId_uidx";--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "discounted_amount_in_paise" integer;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "discount_available_till" timestamp;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "created_by_user" text;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "updated_by_user" text;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "deleted_by_user" text;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_plans_isDeleted_isActive_idx" ON "subscription_plans" USING btree ("is_deleted","is_active");--> statement-breakpoint
CREATE INDEX "subscription_plans_discountAvailableTill_idx" ON "subscription_plans" USING btree ("discount_available_till");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_plans_code_uidx" ON "subscription_plans" USING btree ("code") WHERE "subscription_plans"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_plans_razorpayPlanId_uidx" ON "subscription_plans" USING btree ("razorpay_plan_id") WHERE "subscription_plans"."is_deleted" = false;