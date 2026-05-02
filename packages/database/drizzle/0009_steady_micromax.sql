ALTER TABLE "subscription_plans" ADD COLUMN "is_recommended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_plans_isRecommended_uidx" ON "subscription_plans" USING btree ("is_recommended") WHERE "subscription_plans"."is_deleted" = false and "subscription_plans"."is_recommended" = true;--> statement-breakpoint
