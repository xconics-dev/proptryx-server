ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "organization" ADD COLUMN IF NOT EXISTS "deleted_by_user" text;--> statement-breakpoint
ALTER TABLE "company_request" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'organization_deleted_by_user_user_id_fk'
  ) THEN
    ALTER TABLE "organization"
      ADD CONSTRAINT "organization_deleted_by_user_user_id_fk"
      FOREIGN KEY ("deleted_by_user")
      REFERENCES "public"."user"("id")
      ON DELETE set null
      ON UPDATE no action;
  END IF;
END $$;
