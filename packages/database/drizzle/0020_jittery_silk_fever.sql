CREATE TYPE "public"."meeting_type" AS ENUM('MEETING', 'SITE_VISIT');--> statement-breakpoint
ALTER TABLE "meeting" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "meeting" ALTER COLUMN "status" SET DEFAULT 'REQUESTED'::text;--> statement-breakpoint
DROP TYPE "public"."meeting_status";--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('REQUESTED', 'SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED', 'ON_HOLD');--> statement-breakpoint
DROP INDEX "meeting_isDeleted_status_scheduledAt_idx";--> statement-breakpoint
ALTER TABLE "meeting" ALTER COLUMN "scheduled_at" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "meeting" ALTER COLUMN "scheduled_at" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "type" "meeting_type" DEFAULT 'MEETING' NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "agenda" text;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "request_note" text;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "location" text;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "requested_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "confirmed_at" timestamp;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "cancelled_at" timestamp;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "cancellation_reason" text;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "mom_published_at" timestamp;--> statement-breakpoint
ALTER TABLE "meeting" ADD COLUMN "requested_by_user" text;--> statement-breakpoint
UPDATE "meeting"
SET
	"type" = CASE
		WHEN "status" = 'SITE_VISIT' THEN 'SITE_VISIT'::"public"."meeting_type"
		ELSE 'MEETING'::"public"."meeting_type"
	END,
	"status" = CASE
		WHEN "status" = 'SITE_VISIT' THEN 'SCHEDULED'
		WHEN "status" = 'PROPERTY_DETAILS_APPROVED' THEN 'COMPLETED'
		WHEN "status" = 'ACCEPTED' THEN 'SCHEDULED'
		ELSE "status"
	END;--> statement-breakpoint
ALTER TABLE "meeting" ALTER COLUMN "status" SET DEFAULT 'REQUESTED'::"public"."meeting_status";--> statement-breakpoint
ALTER TABLE "meeting" ALTER COLUMN "status" SET DATA TYPE "public"."meeting_status" USING "status"::"public"."meeting_status";--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_requested_by_user_user_id_fk" FOREIGN KEY ("requested_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_requestedByUser_idx" ON "meeting" USING btree ("requested_by_user");--> statement-breakpoint
CREATE INDEX "meeting_type_idx" ON "meeting" USING btree ("type");--> statement-breakpoint
CREATE INDEX "meeting_requestedAt_idx" ON "meeting" USING btree ("requested_at");--> statement-breakpoint
CREATE INDEX "meeting_isDeleted_type_status_requestedAt_idx" ON "meeting" USING btree ("is_deleted","type","status","requested_at");
