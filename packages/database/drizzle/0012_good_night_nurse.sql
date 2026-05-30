ALTER TABLE "notification_trigger" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notification_trigger" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "notification_trigger" ADD COLUMN "deleted_by_user" text;--> statement-breakpoint
ALTER TABLE "notification_trigger" ADD CONSTRAINT "notification_trigger_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_trigger_isDeleted_idx" ON "notification_trigger" USING btree ("is_deleted");