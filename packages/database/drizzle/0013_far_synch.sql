CREATE TYPE "public"."business_district_type" AS ENUM('CBD', 'SBD', 'TBD');--> statement-breakpoint
CREATE TYPE "public"."parking_access_type" AS ENUM('DIRECT_ENTRY', 'THROUGH_RAMP', 'MULTI_LEVEL_ACCESS');--> statement-breakpoint
CREATE TYPE "public"."parking_configuration" AS ENUM('BASE_PARKING', 'INDIVIDUAL_COVERED_SPACE', 'HYDRAULIC_RACK');--> statement-breakpoint
CREATE TYPE "public"."parking_security_control" AS ENUM('RFID_ENTRY', 'MANUAL_TICKETING', 'ANPR', 'CCTV_ENABLED');--> statement-breakpoint
CREATE TYPE "public"."parking_type" AS ENUM('BASEMENT', 'COVERED', 'OPENED');--> statement-breakpoint
CREATE TYPE "public"."parking_ventilation_type" AS ENUM('NATURAL', 'MECHANICAL');--> statement-breakpoint
CREATE TYPE "public"."property_ownership_type" AS ENUM('SINGLE_OWNER', 'MULTIPLE_OWNER');--> statement-breakpoint
CREATE TYPE "public"."retail_brand_category" AS ENUM('HYPERMARKET', 'APPAREL', 'F_AND_B', 'MULTIPLEX', 'ACCESSORIES', 'DEPARTMENTAL_STORES', 'OTHERS');--> statement-breakpoint
CREATE TYPE "public"."retail_mall_type" AS ENUM('MALL', 'HIGH_STREET');--> statement-breakpoint
CREATE TYPE "public"."retail_store_type" AS ENUM('ANCHOR', 'VANILLA');--> statement-breakpoint
CREATE TYPE "public"."warehouse_construction_type" AS ENUM('RCC_COMPLIANT', 'NON_RCC');--> statement-breakpoint
CREATE TABLE "property_office" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"floor" text,
	"building_name" text,
	"business_district_type" "business_district_type",
	"car_parks_available" integer,
	"toilets_count" integer,
	CONSTRAINT "property_office_propertyId_unique" UNIQUE("property_id")
);
--> statement-breakpoint
CREATE TABLE "property_owner" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "property_owner_propertyId_userId_unique" UNIQUE("property_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "property_parking" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"parking_type" "parking_type" NOT NULL,
	"parking_configuration" "parking_configuration" NOT NULL,
	"total_capacity" integer,
	"access_type" "parking_access_type",
	"security_control" "parking_security_control"[] DEFAULT '{}' NOT NULL,
	"ventilation_type" "parking_ventilation_type",
	"height_clearance_ft" real,
	CONSTRAINT "property_parking_propertyId_unique" UNIQUE("property_id")
);
--> statement-breakpoint
CREATE TABLE "property_retail" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"property_type" "retail_mall_type" NOT NULL,
	"store_type" "retail_store_type" NOT NULL,
	"frontage_width_ft" real,
	"beam_bottom_height_ft" real,
	"neighbouring_brands" text[] DEFAULT '{}' NOT NULL,
	"brand_categories" "retail_brand_category"[] DEFAULT '{}' NOT NULL,
	CONSTRAINT "property_retail_propertyId_unique" UNIQUE("property_id")
);
--> statement-breakpoint
CREATE TABLE "property_warehouse" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"eaves_height_ft" real,
	"top_height_ft" real,
	"construction_type" "warehouse_construction_type",
	"height_ratio" real,
	CONSTRAINT "property_warehouse_propertyId_unique" UNIQUE("property_id")
);
--> statement-breakpoint
ALTER TABLE "property" ADD COLUMN "ownership_type" "property_ownership_type" DEFAULT 'SINGLE_OWNER' NOT NULL;--> statement-breakpoint
ALTER TABLE "property_office" ADD CONSTRAINT "property_office_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_owner" ADD CONSTRAINT "property_owner_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_owner" ADD CONSTRAINT "property_owner_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_parking" ADD CONSTRAINT "property_parking_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_retail" ADD CONSTRAINT "property_retail_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_warehouse" ADD CONSTRAINT "property_warehouse_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_office_businessDistrictType_idx" ON "property_office" USING btree ("business_district_type");--> statement-breakpoint
CREATE INDEX "property_owner_propertyId_idx" ON "property_owner" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_owner_userId_idx" ON "property_owner" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "property_parking_parkingType_idx" ON "property_parking" USING btree ("parking_type");--> statement-breakpoint
CREATE INDEX "property_parking_accessType_idx" ON "property_parking" USING btree ("access_type");--> statement-breakpoint
CREATE INDEX "property_retail_propertyType_idx" ON "property_retail" USING btree ("property_type");--> statement-breakpoint
CREATE INDEX "property_retail_storeType_idx" ON "property_retail" USING btree ("store_type");--> statement-breakpoint
CREATE INDEX "property_warehouse_constructionType_idx" ON "property_warehouse" USING btree ("construction_type");