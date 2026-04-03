CREATE TYPE "public"."area_type" AS ENUM('SINGLE', 'SPLIT');--> statement-breakpoint
CREATE TYPE "public"."certificate_status" AS ENUM('PENDING', 'RECEIVED', 'NOT_REQUIRED');--> statement-breakpoint
CREATE TYPE "public"."certificate_type" AS ENUM('OC', 'CC');--> statement-breakpoint
CREATE TYPE "public"."price_unit" AS ENUM('PER_SQFT', 'LUMP_SUM', 'PER_MONTH');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('LEASE', 'SALE', 'LEASE_PURCHASE');--> statement-breakpoint
ALTER TABLE "property" ALTER COLUMN "location_metadata" SET DEFAULT '{"distances":{"airportKm":0,"railwayKm":0,"highwayKm":0,"commercialHubKm":0,"competitionKm":0}}'::jsonb;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "is_operational" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "certificate_type" "certificate_type" DEFAULT 'OC' NOT NULL;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "certificate_status" "certificate_status" DEFAULT 'PENDING' NOT NULL;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "certificate_eta_date" timestamp;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "certificate_received_at" timestamp;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "total_area_sqft" real;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "road_width_ft" real;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "area_type" "area_type" DEFAULT 'SINGLE' NOT NULL;--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "transaction_type" "transaction_type";--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "price_unit" "price_unit";--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "price_negotiable" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "property_owner" ADD COLUMN "floor_number" text;--> statement-breakpoint
ALTER TABLE "property_owner" ADD COLUMN "allocated_area_sqft" real;--> statement-breakpoint
ALTER TABLE "property_owner" ADD COLUMN "area_description" text;--> statement-breakpoint
ALTER TABLE "property_owner" ADD COLUMN "price_per_unit" real;--> statement-breakpoint
ALTER TABLE "property_owner" ADD COLUMN "price_unit" "price_unit";--> statement-breakpoint
ALTER TABLE "property_owner" ADD COLUMN "price_negotiable" boolean;--> statement-breakpoint
CREATE INDEX "property_certificateStatus_idx" ON "property" USING btree ("certificate_status");