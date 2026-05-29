ALTER TABLE "notification" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
CREATE INDEX "notification_user_id_archived_at_idx" ON "notification" USING btree ("user_id","archived_at");--> statement-breakpoint
CREATE INDEX "notification_user_id_deleted_at_idx" ON "notification" USING btree ("user_id","deleted_at");