CREATE TYPE "public"."access_panel" AS ENUM('proptryx', 'company');--> statement-breakpoint
CREATE TYPE "public"."business_type" AS ENUM('B2B', 'B2C', 'BOTH', 'GENERAL');--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('DEVELOPER', 'OCCUPIER', 'MANAGEMENT', 'APPLICATION', 'BROKER');--> statement-breakpoint
CREATE TYPE "public"."permission_access_level" AS ENUM('company', 'user', 'all');--> statement-breakpoint
CREATE TYPE "public"."area_type" AS ENUM('SINGLE', 'SPLIT');--> statement-breakpoint
CREATE TYPE "public"."business_district_type" AS ENUM('CBD', 'SBD', 'TBD');--> statement-breakpoint
CREATE TYPE "public"."certificate_status" AS ENUM('PENDING', 'RECEIVED', 'NOT_REQUIRED');--> statement-breakpoint
CREATE TYPE "public"."certificate_type" AS ENUM('OC', 'CC');--> statement-breakpoint
CREATE TYPE "public"."parking_access_type" AS ENUM('DIRECT_ENTRY', 'THROUGH_RAMP', 'MULTI_LEVEL_ACCESS');--> statement-breakpoint
CREATE TYPE "public"."parking_configuration" AS ENUM('BASE_PARKING', 'INDIVIDUAL_COVERED_SPACE', 'HYDRAULIC_RACK');--> statement-breakpoint
CREATE TYPE "public"."parking_security_control" AS ENUM('RFID_ENTRY', 'MANUAL_TICKETING', 'ANPR', 'CCTV_ENABLED');--> statement-breakpoint
CREATE TYPE "public"."parking_type" AS ENUM('BASEMENT', 'COVERED', 'OPENED');--> statement-breakpoint
CREATE TYPE "public"."parking_ventilation_type" AS ENUM('NATURAL', 'MECHANICAL');--> statement-breakpoint
CREATE TYPE "public"."price_unit" AS ENUM('PER_SQFT', 'LUMP_SUM', 'PER_MONTH');--> statement-breakpoint
CREATE TYPE "public"."property_media_type" AS ENUM('IMAGE', 'DOCUMENT');--> statement-breakpoint
CREATE TYPE "public"."property_media_visibility" AS ENUM('PUBLIC', 'PRIVATE');--> statement-breakpoint
CREATE TYPE "public"."property_ownership_type" AS ENUM('SINGLE_OWNER', 'MULTIPLE_OWNER');--> statement-breakpoint
CREATE TYPE "public"."property_status" AS ENUM('VACANT', 'BUILD_TO_SUITE', 'READY_TO_MOVE', 'UNDER_NEGOTIATION', 'BOOKED', 'CLOSED', 'ON_HOLD');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('RETAIL', 'OFFICE', 'WAREHOUSE', 'COMMERCIAL_PARKING');--> statement-breakpoint
CREATE TYPE "public"."retail_brand_category" AS ENUM('HYPERMARKET', 'APPAREL', 'F_AND_B', 'MULTIPLEX', 'ACCESSORIES', 'DEPARTMENTAL_STORES', 'OTHERS');--> statement-breakpoint
CREATE TYPE "public"."retail_mall_type" AS ENUM('MALL', 'HIGH_STREET');--> statement-breakpoint
CREATE TYPE "public"."retail_store_type" AS ENUM('ANCHOR', 'VANILLA');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('LEASE', 'SALE', 'LEASE_PURCHASE');--> statement-breakpoint
CREATE TYPE "public"."warehouse_construction_type" AS ENUM('RCC_COMPLIANT', 'NON_RCC');--> statement-breakpoint
CREATE TYPE "public"."meeting_status" AS ENUM('REQUESTED', 'SCHEDULED', 'COMPLETED', 'CANCELLED', 'REJECTED', 'IN_PROGRESS');--> statement-breakpoint
CREATE TYPE "public"."meeting_type" AS ENUM('MEETING', 'SITE_VISIT');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"email" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"inviter_id" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "member" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"panel" "access_panel" DEFAULT 'company' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_by_user" text
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"type" "organization_type" NOT NULL,
	"business_type" "business_type" DEFAULT 'GENERAL',
	"metadata" text,
	"email" text,
	"gst_number" text,
	"phone_number" text,
	"industry" text,
	"company_type" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"razorpay_customer_id" text,
	"created_by_user" text,
	"updated_by_user" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_user" text,
	CONSTRAINT "organization_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "organization_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"subscription_plan_id" text,
	"plan_code" text NOT NULL,
	"razorpay_customer_id" text NOT NULL,
	"razorpay_subscription_id" text,
	"razorpay_plan_id" text NOT NULL,
	"status" text DEFAULT 'created' NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"total_count" integer,
	"paid_count" integer DEFAULT 0 NOT NULL,
	"remaining_count" integer,
	"base_amount_in_paise" integer DEFAULT 0 NOT NULL,
	"billing_period" text DEFAULT 'monthly' NOT NULL,
	"trial_days_applied" integer DEFAULT 0 NOT NULL,
	"additional_properties" integer DEFAULT 0 NOT NULL,
	"addon_property_one_time_cost_in_paise" integer DEFAULT 0 NOT NULL,
	"addon_one_time_total_in_paise" integer DEFAULT 0 NOT NULL,
	"current_start" timestamp,
	"current_end" timestamp,
	"trial_start" timestamp,
	"trial_end" timestamp,
	"ended_at" timestamp,
	"cancelled_at" timestamp,
	"paused_at" timestamp,
	"short_url" text,
	"cancel_at_cycle_end" boolean DEFAULT false NOT NULL,
	"notes" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"active_organization_id" text,
	"impersonated_by" text
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"amount_in_paise" integer NOT NULL,
	"discounted_amount_in_paise" integer,
	"discount_available_till" timestamp,
	"currency" text DEFAULT 'INR' NOT NULL,
	"billing_interval" text DEFAULT 'monthly' NOT NULL,
	"razorpay_plan_id" text NOT NULL,
	"total_count" integer,
	"quantity" integer DEFAULT 1 NOT NULL,
	"trial_days" integer DEFAULT 0 NOT NULL,
	"addon_property_one_time_cost_in_paise" integer DEFAULT 0 NOT NULL,
	"features" jsonb DEFAULT '{"maxProperties":0,"maxUsers":0}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text,
	"panel" "access_panel",
	"zone_id" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"phone_number" text,
	"phone_number_verified" boolean DEFAULT false,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"deleted_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "rbac_role" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"panel" "access_panel" NOT NULL,
	"organization_id" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rbac_role_permission" (
	"id" text PRIMARY KEY NOT NULL,
	"role_id" text NOT NULL,
	"resource" text NOT NULL,
	"access_level" "permission_access_level" DEFAULT 'all' NOT NULL,
	"actions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_request" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_name" text NOT NULL,
	"owner_email" text NOT NULL,
	"owner_phone" text NOT NULL,
	"company_gst_number" text NOT NULL,
	"company_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_user" text
);
--> statement-breakpoint
CREATE TABLE "broker_request" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"phone_number" text NOT NULL,
	"pincode" text NOT NULL,
	"address" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_user" text
);
--> statement-breakpoint
CREATE TABLE "region" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_by_user" text,
	"updated_by_user" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_user" text,
	CONSTRAINT "region_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "zone" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"region_id" text NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_user" text
);
--> statement-breakpoint
CREATE TABLE "property" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"country" text NOT NULL,
	"state" text NOT NULL,
	"city" text NOT NULL,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"pincode" text NOT NULL,
	"latitude" real,
	"longitude" real,
	"location_metadata" jsonb DEFAULT '{"distances":{"airportKm":0,"railwayKm":0,"highwayKm":0,"commercialHubKm":0,"competitionKm":0}}'::jsonb NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"is_operational" boolean DEFAULT false NOT NULL,
	"certificate_type" "certificate_type" DEFAULT 'OC' NOT NULL,
	"certificate_status" "certificate_status" DEFAULT 'PENDING' NOT NULL,
	"certificate_eta_date" timestamp,
	"certificate_received_at" timestamp,
	"total_area_sqft" real,
	"road_width_ft" real,
	"area_type" "area_type" DEFAULT 'SINGLE' NOT NULL,
	"transaction_type" "transaction_type",
	"price_unit" "price_unit",
	"price_negotiable" boolean DEFAULT true NOT NULL,
	"type" "property_type" NOT NULL,
	"status" "property_status" NOT NULL,
	"ownership_type" "property_ownership_type" DEFAULT 'SINGLE_OWNER' NOT NULL,
	"super_owner_id" text,
	"created_by_user" text,
	"updated_by_user" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_user" text
);
--> statement-breakpoint
CREATE TABLE "property_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"media_type" "property_media_type" NOT NULL,
	"name" text NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"mime_type" text,
	"size_bytes" integer,
	"visibility" "property_media_visibility" DEFAULT 'PUBLIC' NOT NULL,
	"sort_order" integer DEFAULT 0,
	"alt_text" text,
	"is_thumbnail" boolean DEFAULT false NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_user" text
);
--> statement-breakpoint
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
	"floor_number" text,
	"allocated_area_sqft" real,
	"area_description" text,
	"price_per_unit" real,
	"price_unit" "price_unit",
	"price_negotiable" boolean,
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
CREATE TABLE "property_zone" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"zone_id" text NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_user" text,
	CONSTRAINT "property_zone_propertyId_zoneId_unique" UNIQUE("property_id","zone_id")
);
--> statement-breakpoint
CREATE TABLE "meeting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" "meeting_type" DEFAULT 'MEETING' NOT NULL,
	"status" "meeting_status" DEFAULT 'REQUESTED' NOT NULL,
	"agenda" text,
	"request_note" text,
	"location" text,
	"latitude" text,
	"longitude" text,
	"mom" text,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"scheduled_at" timestamp,
	"confirmed_at" timestamp,
	"completed_at" timestamp,
	"cancelled_at" timestamp,
	"cancellation_reason" text,
	"mom_published_at" timestamp,
	"developer_id" text,
	"property_id" uuid NOT NULL,
	"occupier_id" text,
	"requested_by_user" text,
	"created_by_user" text,
	"updated_by_user" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_user" text
);
--> statement-breakpoint
CREATE TABLE "faq" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" text,
	"question" text NOT NULL,
	"answer" text,
	"is_archived" boolean DEFAULT false NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_by_user" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text
);
--> statement-breakpoint
CREATE TABLE "testimonial" (
	"id" text PRIMARY KEY NOT NULL,
	"property_id" text,
	"image" text,
	"author_name" text NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"designation" text,
	"description" text NOT NULL,
	"ratings" real NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_by_user" text,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_subscription" ADD CONSTRAINT "organization_subscription_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_subscription" ADD CONSTRAINT "organization_subscription_subscription_plan_id_subscription_plans_id_fk" FOREIGN KEY ("subscription_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_active_organization_id_organization_id_fk" FOREIGN KEY ("active_organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_zone_id_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zone"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_role" ADD CONSTRAINT "rbac_role_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rbac_role_permission" ADD CONSTRAINT "rbac_role_permission_role_id_rbac_role_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."rbac_role"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_request" ADD CONSTRAINT "company_request_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_request" ADD CONSTRAINT "company_request_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_request" ADD CONSTRAINT "company_request_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_request" ADD CONSTRAINT "broker_request_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_request" ADD CONSTRAINT "broker_request_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_request" ADD CONSTRAINT "broker_request_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region" ADD CONSTRAINT "region_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region" ADD CONSTRAINT "region_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region" ADD CONSTRAINT "region_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone" ADD CONSTRAINT "zone_region_id_region_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."region"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone" ADD CONSTRAINT "zone_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone" ADD CONSTRAINT "zone_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone" ADD CONSTRAINT "zone_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_super_owner_id_user_id_fk" FOREIGN KEY ("super_owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_office" ADD CONSTRAINT "property_office_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_owner" ADD CONSTRAINT "property_owner_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_owner" ADD CONSTRAINT "property_owner_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_parking" ADD CONSTRAINT "property_parking_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_retail" ADD CONSTRAINT "property_retail_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_warehouse" ADD CONSTRAINT "property_warehouse_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_zone" ADD CONSTRAINT "property_zone_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_zone" ADD CONSTRAINT "property_zone_zone_id_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_zone" ADD CONSTRAINT "property_zone_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_zone" ADD CONSTRAINT "property_zone_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_zone" ADD CONSTRAINT "property_zone_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_developer_id_user_id_fk" FOREIGN KEY ("developer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_occupier_id_user_id_fk" FOREIGN KEY ("occupier_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_requested_by_user_user_id_fk" FOREIGN KEY ("requested_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq" ADD CONSTRAINT "faq_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq" ADD CONSTRAINT "faq_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq" ADD CONSTRAINT "faq_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq" ADD CONSTRAINT "faq_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonial" ADD CONSTRAINT "testimonial_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonial" ADD CONSTRAINT "testimonial_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonial" ADD CONSTRAINT "testimonial_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "member_panel_idx" ON "member" USING btree ("panel");--> statement-breakpoint
CREATE INDEX "member_organizationId_role_idx" ON "member" USING btree ("organization_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uidx" ON "organization" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "organization_isDeleted_createdAt_idx" ON "organization" USING btree ("is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "organization_isDeleted_updatedAt_idx" ON "organization" USING btree ("is_deleted","updated_at");--> statement-breakpoint
CREATE INDEX "organization_isDeleted_name_idx" ON "organization" USING btree ("is_deleted","name");--> statement-breakpoint
CREATE INDEX "organization_isDeleted_type_idx" ON "organization" USING btree ("is_deleted","type");--> statement-breakpoint
CREATE INDEX "organization_isDeleted_isActive_idx" ON "organization" USING btree ("is_deleted","is_active");--> statement-breakpoint
CREATE INDEX "organization_email_idx" ON "organization" USING btree ("email");--> statement-breakpoint
CREATE INDEX "organization_phoneNumber_idx" ON "organization" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "organization_gstNumber_idx" ON "organization" USING btree ("gst_number");--> statement-breakpoint
CREATE INDEX "organization_razorpayCustomerId_idx" ON "organization" USING btree ("razorpay_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_subscription_organizationId_uidx" ON "organization_subscription" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_subscription_razorpaySubscriptionId_uidx" ON "organization_subscription" USING btree ("razorpay_subscription_id");--> statement-breakpoint
CREATE INDEX "organization_subscription_status_idx" ON "organization_subscription" USING btree ("status");--> statement-breakpoint
CREATE INDEX "organization_subscription_planCode_idx" ON "organization_subscription" USING btree ("plan_code");--> statement-breakpoint
CREATE INDEX "organization_subscription_subscriptionPlanId_idx" ON "organization_subscription" USING btree ("subscription_plan_id");--> statement-breakpoint
CREATE UNIQUE INDEX "session_token_uidx" ON "session" USING btree ("token");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_activeOrganizationId_idx" ON "session" USING btree ("active_organization_id");--> statement-breakpoint
CREATE INDEX "session_expiresAt_idx" ON "session" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_plans_code_uidx" ON "subscription_plans" USING btree ("code") WHERE "subscription_plans"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_plans_razorpayPlanId_uidx" ON "subscription_plans" USING btree ("razorpay_plan_id") WHERE "subscription_plans"."is_deleted" = false;--> statement-breakpoint
CREATE INDEX "subscription_plans_isDeleted_isActive_idx" ON "subscription_plans" USING btree ("is_deleted","is_active");--> statement-breakpoint
CREATE INDEX "subscription_plans_discountAvailableTill_idx" ON "subscription_plans" USING btree ("discount_available_till");--> statement-breakpoint
CREATE INDEX "user_name_idx" ON "user" USING btree ("name");--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "user" USING btree ("role");--> statement-breakpoint
CREATE INDEX "user_panel_idx" ON "user" USING btree ("panel");--> statement-breakpoint
CREATE INDEX "user_zoneId_idx" ON "user" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "rbac_role_panel_idx" ON "rbac_role" USING btree ("panel");--> statement-breakpoint
CREATE INDEX "rbac_role_org_idx" ON "rbac_role" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "rbac_role_slug_idx" ON "rbac_role" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "rbac_role_panel_slug_idx" ON "rbac_role" USING btree ("panel","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "rbac_role_permission_role_resource_uidx" ON "rbac_role_permission" USING btree ("role_id","resource");--> statement-breakpoint
CREATE INDEX "rbac_role_permission_resource_idx" ON "rbac_role_permission" USING btree ("resource");--> statement-breakpoint
CREATE UNIQUE INDEX "company_request_gst_number_uidx" ON "company_request" USING btree ("company_gst_number");--> statement-breakpoint
CREATE INDEX "company_request_owner_email_idx" ON "company_request" USING btree ("owner_email");--> statement-breakpoint
CREATE INDEX "company_request_owner_phone_idx" ON "company_request" USING btree ("owner_phone");--> statement-breakpoint
CREATE INDEX "company_request_isDeleted_createdAt_idx" ON "company_request" USING btree ("is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "company_request_owner_name_trgm_idx" ON "company_request" USING gin (lower("owner_name") gin_trgm_ops) WHERE "company_request"."is_deleted" = false;--> statement-breakpoint
CREATE INDEX "company_request_owner_email_trgm_idx" ON "company_request" USING gin (lower("owner_email") gin_trgm_ops) WHERE "company_request"."is_deleted" = false;--> statement-breakpoint
CREATE INDEX "company_request_owner_phone_trgm_idx" ON "company_request" USING gin (lower("owner_phone") gin_trgm_ops) WHERE "company_request"."is_deleted" = false;--> statement-breakpoint
CREATE INDEX "company_request_company_gst_trgm_idx" ON "company_request" USING gin (lower("company_gst_number") gin_trgm_ops) WHERE "company_request"."is_deleted" = false;--> statement-breakpoint
CREATE INDEX "company_request_company_email_trgm_idx" ON "company_request" USING gin (lower("company_email") gin_trgm_ops) WHERE "company_request"."is_deleted" = false and "company_request"."company_email" is not null;--> statement-breakpoint
CREATE INDEX "broker_request_email_idx" ON "broker_request" USING btree ("email");--> statement-breakpoint
CREATE INDEX "broker_request_phone_idx" ON "broker_request" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "broker_request_isDeleted_createdAt_idx" ON "broker_request" USING btree ("is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "broker_request_name_trgm_idx" ON "broker_request" USING gin (lower("name") gin_trgm_ops) WHERE "broker_request"."is_deleted" = false;--> statement-breakpoint
CREATE INDEX "broker_request_email_trgm_idx" ON "broker_request" USING gin (lower("email") gin_trgm_ops) WHERE "broker_request"."is_deleted" = false;--> statement-breakpoint
CREATE INDEX "broker_request_phone_trgm_idx" ON "broker_request" USING gin (lower("phone_number") gin_trgm_ops) WHERE "broker_request"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "region_name_uidx" ON "region" USING btree ("name");--> statement-breakpoint
CREATE INDEX "zone_regionId_idx" ON "zone" USING btree ("region_id");--> statement-breakpoint
CREATE UNIQUE INDEX "zone_regionId_name_uidx" ON "zone" USING btree ("region_id","name");--> statement-breakpoint
CREATE INDEX "property_name_idx" ON "property" USING btree ("name");--> statement-breakpoint
CREATE INDEX "property_superOwnerId_idx" ON "property" USING btree ("super_owner_id");--> statement-breakpoint
CREATE INDEX "property_type_idx" ON "property" USING btree ("type");--> statement-breakpoint
CREATE INDEX "property_status_idx" ON "property" USING btree ("status");--> statement-breakpoint
CREATE INDEX "property_city_idx" ON "property" USING btree ("city");--> statement-breakpoint
CREATE INDEX "property_pincode_idx" ON "property" USING btree ("pincode");--> statement-breakpoint
CREATE INDEX "property_certificateStatus_idx" ON "property" USING btree ("certificate_status");--> statement-breakpoint
CREATE INDEX "property_isDeleted_isPublished_createdAt_idx" ON "property" USING btree ("is_deleted","is_published","created_at");--> statement-breakpoint
CREATE INDEX "property_media_propertyId_idx" ON "property_media" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_media_propertyId_mediaType_idx" ON "property_media" USING btree ("property_id","media_type");--> statement-breakpoint
CREATE INDEX "property_media_propertyId_isThumbnail_idx" ON "property_media" USING btree ("property_id","is_thumbnail");--> statement-breakpoint
CREATE INDEX "property_media_isDeleted_propertyId_idx" ON "property_media" USING btree ("is_deleted","property_id");--> statement-breakpoint
CREATE INDEX "property_office_businessDistrictType_idx" ON "property_office" USING btree ("business_district_type");--> statement-breakpoint
CREATE INDEX "property_owner_propertyId_idx" ON "property_owner" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_owner_userId_idx" ON "property_owner" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "property_parking_parkingType_idx" ON "property_parking" USING btree ("parking_type");--> statement-breakpoint
CREATE INDEX "property_parking_accessType_idx" ON "property_parking" USING btree ("access_type");--> statement-breakpoint
CREATE INDEX "property_retail_propertyType_idx" ON "property_retail" USING btree ("property_type");--> statement-breakpoint
CREATE INDEX "property_retail_storeType_idx" ON "property_retail" USING btree ("store_type");--> statement-breakpoint
CREATE INDEX "property_warehouse_constructionType_idx" ON "property_warehouse" USING btree ("construction_type");--> statement-breakpoint
CREATE INDEX "property_zone_propertyId_idx" ON "property_zone" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_zone_zoneId_idx" ON "property_zone" USING btree ("zone_id");--> statement-breakpoint
CREATE INDEX "property_zone_isDeleted_propertyId_idx" ON "property_zone" USING btree ("is_deleted","property_id");--> statement-breakpoint
CREATE INDEX "meeting_propertyId_idx" ON "meeting" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "meeting_developerId_idx" ON "meeting" USING btree ("developer_id");--> statement-breakpoint
CREATE INDEX "meeting_occupierId_idx" ON "meeting" USING btree ("occupier_id");--> statement-breakpoint
CREATE INDEX "meeting_requestedByUser_idx" ON "meeting" USING btree ("requested_by_user");--> statement-breakpoint
CREATE INDEX "meeting_type_idx" ON "meeting" USING btree ("type");--> statement-breakpoint
CREATE INDEX "meeting_status_idx" ON "meeting" USING btree ("status");--> statement-breakpoint
CREATE INDEX "meeting_requestedAt_idx" ON "meeting" USING btree ("requested_at");--> statement-breakpoint
CREATE INDEX "meeting_scheduledAt_idx" ON "meeting" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "meeting_isDeleted_type_status_requestedAt_idx" ON "meeting" USING btree ("is_deleted","type","status","requested_at");--> statement-breakpoint
CREATE INDEX "faq_property_id_idx" ON "faq" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "faq_question_idx" ON "faq" USING btree ("question");--> statement-breakpoint
CREATE INDEX "faq_isDeleted_isArchived_createdAt_idx" ON "faq" USING btree ("is_deleted","is_archived","created_at");--> statement-breakpoint
CREATE INDEX "testimonial_property_id_idx" ON "testimonial" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "testimonial_author_name_idx" ON "testimonial" USING btree ("author_name");--> statement-breakpoint
CREATE INDEX "testimonial_isDeleted_isArchived_createdAt_idx" ON "testimonial" USING btree ("is_deleted","is_archived","created_at");