ALTER TABLE "organization" ADD COLUMN "email" text;--> statement-breakpoint
CREATE INDEX "organization_email_idx" ON "organization" USING btree ("email");