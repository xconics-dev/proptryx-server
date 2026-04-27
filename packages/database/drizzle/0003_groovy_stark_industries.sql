CREATE INDEX "member_organizationId_isDeleted_userId_idx" ON "member" USING btree ("organization_id","is_deleted","user_id");--> statement-breakpoint
CREATE INDEX "member_organizationId_isDeleted_role_idx" ON "member" USING btree ("organization_id","is_deleted","role");--> statement-breakpoint
CREATE INDEX "organization_subscription_subscriptionPlanId_status_idx" ON "organization_subscription" USING btree ("subscription_plan_id","status");--> statement-breakpoint
CREATE INDEX "property_createdByUser_idx" ON "property" USING btree ("created_by_user");--> statement-breakpoint
CREATE INDEX "property_isDeleted_superOwnerId_idx" ON "property" USING btree ("is_deleted","super_owner_id");--> statement-breakpoint
CREATE INDEX "property_isDeleted_createdByUser_idx" ON "property" USING btree ("is_deleted","created_by_user");
