ALTER TABLE "organization_subscription" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_subscription" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "organization_subscription" ADD COLUMN "deleted_by_user" text;--> statement-breakpoint
ALTER TABLE "organization_subscription" ADD CONSTRAINT "organization_subscription_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_subscription_isDeleted_idx" ON "organization_subscription" USING btree ("is_deleted");--> statement-breakpoint
DROP INDEX "organization_subscription_organizationId_uidx";--> statement-breakpoint
DROP INDEX "organization_subscription_razorpaySubscriptionId_uidx";--> statement-breakpoint
CREATE UNIQUE INDEX "organization_subscription_organizationId_uidx" ON "organization_subscription" USING btree ("organization_id") WHERE "organization_subscription"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "organization_subscription_razorpaySubscriptionId_uidx" ON "organization_subscription" USING btree ("razorpay_subscription_id") WHERE "organization_subscription"."is_deleted" = false and "organization_subscription"."razorpay_subscription_id" is not null;
