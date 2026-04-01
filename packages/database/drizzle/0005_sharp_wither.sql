ALTER TABLE "region" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "zone" ADD COLUMN "description" text;--> statement-breakpoint
CREATE INDEX "organization_isDeleted_createdAt_idx" ON "organization" USING btree ("is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "organization_isDeleted_updatedAt_idx" ON "organization" USING btree ("is_deleted","updated_at");--> statement-breakpoint
CREATE INDEX "organization_isDeleted_name_idx" ON "organization" USING btree ("is_deleted","name");--> statement-breakpoint
CREATE INDEX "organization_isDeleted_type_idx" ON "organization" USING btree ("is_deleted","type");--> statement-breakpoint
CREATE INDEX "organization_isDeleted_isActive_idx" ON "organization" USING btree ("is_deleted","is_active");--> statement-breakpoint
CREATE INDEX "organization_email_idx" ON "organization" USING btree ("email");--> statement-breakpoint
CREATE INDEX "organization_phoneNumber_idx" ON "organization" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "organization_gstNumber_idx" ON "organization" USING btree ("gst_number");--> statement-breakpoint
CREATE INDEX "user_name_idx" ON "user" USING btree ("name");