DROP INDEX "company_request_gst_number_uidx";--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_organizationId_idx" ON "property" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "property_isDeleted_organizationId_idx" ON "property" USING btree ("is_deleted","organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "company_request_gst_number_uidx" ON "company_request" USING btree ("company_gst_number") WHERE "company_request"."is_deleted" = false;