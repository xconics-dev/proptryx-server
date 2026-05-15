ALTER TYPE "public"."property_media_type" ADD VALUE 'VIDEO' BEFORE 'DOCUMENT';--> statement-breakpoint
ALTER TABLE "meeting" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "meeting" ALTER COLUMN "type" SET DEFAULT 'ONLINE'::text;--> statement-breakpoint
DROP TYPE "public"."meeting_type";--> statement-breakpoint
CREATE TYPE "public"."meeting_type" AS ENUM('ONLINE', 'SITE_VISIT');--> statement-breakpoint
ALTER TABLE "meeting" ALTER COLUMN "type" SET DEFAULT 'ONLINE'::"public"."meeting_type";--> statement-breakpoint
ALTER TABLE "meeting" ALTER COLUMN "type" SET DATA TYPE "public"."meeting_type" USING "type"::"public"."meeting_type";--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "total_floors" integer;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "transaction_type" "handover_type";--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "price_per_unit" real;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "price_unit" "price_unit";--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "price_negotiable" boolean DEFAULT false NOT NULL;