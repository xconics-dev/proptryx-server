ALTER TABLE "organization_subscription" ADD COLUMN "created_by_user" text;--> statement-breakpoint
ALTER TABLE "organization_subscription" ADD COLUMN "updated_by_user" text;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "is_recommended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization_subscription" ADD CONSTRAINT "organization_subscription_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_subscription" ADD CONSTRAINT "organization_subscription_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "member_organizationId_isDeleted_userId_idx" ON "member" USING btree ("organization_id","is_deleted","user_id");--> statement-breakpoint
CREATE INDEX "member_organizationId_isDeleted_role_idx" ON "member" USING btree ("organization_id","is_deleted","role");--> statement-breakpoint
CREATE INDEX "organization_subscription_subscriptionPlanId_status_idx" ON "organization_subscription" USING btree ("subscription_plan_id","status");--> statement-breakpoint
CREATE INDEX "organization_subscription_billingPeriod_idx" ON "organization_subscription" USING btree ("billing_period");--> statement-breakpoint
CREATE INDEX "organization_subscription_createdAt_idx" ON "organization_subscription" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "organization_subscription_createdByUser_idx" ON "organization_subscription" USING btree ("created_by_user");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_plans_isRecommended_uidx" ON "subscription_plans" USING btree ("is_recommended") WHERE "subscription_plans"."is_deleted" = false and "subscription_plans"."is_recommended" = true;--> statement-breakpoint
CREATE INDEX "property_createdByUser_idx" ON "property" USING btree ("created_by_user");--> statement-breakpoint
CREATE INDEX "property_isDeleted_superOwnerId_idx" ON "property" USING btree ("is_deleted","super_owner_id");--> statement-breakpoint
CREATE INDEX "property_isDeleted_createdByUser_idx" ON "property" USING btree ("is_deleted","created_by_user");