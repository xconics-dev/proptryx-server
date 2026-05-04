ALTER TABLE "organization_subscription" ADD COLUMN "created_by_user" text;--> statement-breakpoint
ALTER TABLE "organization_subscription" ADD COLUMN "updated_by_user" text;--> statement-breakpoint
ALTER TABLE "organization_subscription" ADD CONSTRAINT "organization_subscription_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_subscription" ADD CONSTRAINT "organization_subscription_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "organization_subscription_billingPeriod_idx" ON "organization_subscription" USING btree ("billing_period");--> statement-breakpoint
CREATE INDEX "organization_subscription_createdAt_idx" ON "organization_subscription" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "organization_subscription_createdByUser_idx" ON "organization_subscription" USING btree ("created_by_user");