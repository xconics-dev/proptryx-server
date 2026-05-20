ALTER TABLE "meeting" ADD COLUMN "google_calendar_event_id" text;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "google_calendar_event_link" text;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "google_meet_space_name" text;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "google_meet_uri" text;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "google_synced_at" timestamp;--> statement-breakpoint
CREATE INDEX "meeting_googleCalendarEventId_idx" ON "meeting" USING btree ("google_calendar_event_id");