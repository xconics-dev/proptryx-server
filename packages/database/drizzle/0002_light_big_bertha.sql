ALTER TABLE "organization" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."organization_type";--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('SELLER', 'DEVELOPER', 'MANAGEMENT');--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "type" SET DATA TYPE "public"."organization_type" USING "type"::"public"."organization_type";