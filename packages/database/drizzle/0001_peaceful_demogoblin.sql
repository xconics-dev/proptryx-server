ALTER TABLE "company_request" ADD COLUMN "is_deleted" text DEFAULT 'false' NOT NULL;--> statement-breakpoint
ALTER TABLE "company_request" ADD COLUMN "deleted_by_user" text;--> statement-breakpoint
ALTER TABLE "company_request" ADD CONSTRAINT "company_request_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;