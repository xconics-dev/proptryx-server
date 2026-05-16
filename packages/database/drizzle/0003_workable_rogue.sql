CREATE TABLE "property_owner_temporary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" text NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone_number" text,
	"floor_number" text,
	"allocated_area_sqft" real,
	"area_description" text,
	"handover_type" "handover_type",
	"price_per_unit" real,
	"price_unit" "price_unit",
	"price_negotiable" boolean
);
--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."organization_type";--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('DEVELOPER', 'OCCUPIER', 'MANAGEMENT');--> statement-breakpoint
ALTER TABLE "organization" ALTER COLUMN "type" SET DATA TYPE "public"."organization_type" USING "type"::"public"."organization_type";--> statement-breakpoint
ALTER TABLE "faq" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "faq" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "property_owner_temporary" ADD CONSTRAINT "property_owner_temporary_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_owner_temporary_propertyId_idx" ON "property_owner_temporary" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_owner_temporary_email_idx" ON "property_owner_temporary" USING btree ("email");--> statement-breakpoint
CREATE INDEX "property_owner_temporary_phoneNumber_idx" ON "property_owner_temporary" USING btree ("phone_number");