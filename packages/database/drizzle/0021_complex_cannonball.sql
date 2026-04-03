ALTER TABLE "meeting" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "meeting" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED'::text;--> statement-breakpoint
DROP TYPE "public"."meeting_status";--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'IN_PROGRESS');--> statement-breakpoint
UPDATE "meeting"
SET "status" = CASE
	WHEN "status" = 'REQUESTED' THEN 'SCHEDULED'
	WHEN "status" = 'ON_HOLD' THEN 'IN_PROGRESS'
	ELSE "status"
END;--> statement-breakpoint
ALTER TABLE "meeting" ALTER COLUMN "status" SET DEFAULT 'SCHEDULED'::"public"."meeting_status";--> statement-breakpoint
ALTER TABLE "meeting" ALTER COLUMN "status" SET DATA TYPE "public"."meeting_status" USING "status"::"public"."meeting_status";
