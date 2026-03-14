ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "email" text;
CREATE INDEX IF NOT EXISTS "organization_email_idx" ON "organization" USING btree ("email");
