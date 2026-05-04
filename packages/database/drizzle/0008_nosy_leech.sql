CREATE TABLE IF NOT EXISTS "broker_request" (
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
ALTER TABLE "subscription_plans" DROP CONSTRAINT "subscription_plans_code_unique";--> statement-breakpoint
DROP INDEX "subscription_plans_isActive_idx";--> statement-breakpoint
DROP INDEX "subscription_plans_code_uidx";--> statement-breakpoint
DROP INDEX "subscription_plans_razorpayPlanId_uidx";--> statement-breakpoint
ALTER TABLE "property_media" DROP CONSTRAINT "property_media_property_id_property_id_fk";--> statement-breakpoint
ALTER TABLE "property_office" DROP CONSTRAINT "property_office_property_id_property_id_fk";--> statement-breakpoint
ALTER TABLE "property_owner" DROP CONSTRAINT "property_owner_property_id_property_id_fk";--> statement-breakpoint
ALTER TABLE "property_parking" DROP CONSTRAINT "property_parking_property_id_property_id_fk";--> statement-breakpoint
ALTER TABLE "property_retail" DROP CONSTRAINT "property_retail_property_id_property_id_fk";--> statement-breakpoint
ALTER TABLE "property_warehouse" DROP CONSTRAINT "property_warehouse_property_id_property_id_fk";--> statement-breakpoint
ALTER TABLE "property_zone" DROP CONSTRAINT "property_zone_property_id_property_id_fk";--> statement-breakpoint
ALTER TABLE "meeting" DROP CONSTRAINT "meeting_property_id_property_id_fk";--> statement-breakpoint
ALTER TABLE "faq" DROP CONSTRAINT "faq_property_id_property_id_fk";--> statement-breakpoint
ALTER TABLE "property" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "property" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "property_media" ALTER COLUMN "property_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "property_office" ALTER COLUMN "property_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "property_owner" ALTER COLUMN "property_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "property_parking" ALTER COLUMN "property_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "property_retail" ALTER COLUMN "property_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "property_warehouse" ALTER COLUMN "property_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "property_zone" ALTER COLUMN "property_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "meeting" ALTER COLUMN "property_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "faq" ALTER COLUMN "property_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "discounted_amount_in_paise" integer;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "discount_available_till" timestamp;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "created_by_user" text;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "updated_by_user" text;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "deleted_by_user" text;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "faq" ADD COLUMN "property_id" text;--> statement-breakpoint
ALTER TABLE "testimonial" ADD COLUMN "property_id" text;--> statement-breakpoint
ALTER TABLE "broker_request" ADD CONSTRAINT "broker_request_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_request" ADD CONSTRAINT "broker_request_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_request" ADD CONSTRAINT "broker_request_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "broker_request_email_idx" ON "broker_request" USING btree ("email");--> statement-breakpoint
CREATE INDEX "broker_request_phone_idx" ON "broker_request" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "broker_request_isDeleted_createdAt_idx" ON "broker_request" USING btree ("is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "broker_request_name_trgm_idx" ON "broker_request" USING gin (lower("name") gin_trgm_ops) WHERE "broker_request"."is_deleted" = false;--> statement-breakpoint
CREATE INDEX "broker_request_email_trgm_idx" ON "broker_request" USING gin (lower("email") gin_trgm_ops) WHERE "broker_request"."is_deleted" = false;--> statement-breakpoint
CREATE INDEX "broker_request_phone_trgm_idx" ON "broker_request" USING gin (lower("phone_number") gin_trgm_ops) WHERE "broker_request"."is_deleted" = false;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD CONSTRAINT "subscription_plans_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_office" ADD CONSTRAINT "property_office_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_owner" ADD CONSTRAINT "property_owner_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_parking" ADD CONSTRAINT "property_parking_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_retail" ADD CONSTRAINT "property_retail_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_warehouse" ADD CONSTRAINT "property_warehouse_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_zone" ADD CONSTRAINT "property_zone_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "faq" ADD CONSTRAINT "faq_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "subscription_plans_isDeleted_isActive_idx" ON "subscription_plans" USING btree ("is_deleted","is_active");--> statement-breakpoint
CREATE INDEX "subscription_plans_discountAvailableTill_idx" ON "subscription_plans" USING btree ("discount_available_till");--> statement-breakpoint
CREATE INDEX "faq_property_id_idx" ON "faq" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "testimonial_property_id_idx" ON "testimonial" USING btree ("property_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_plans_code_uidx" ON "subscription_plans" USING btree ("code") WHERE "subscription_plans"."is_deleted" = false;--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_plans_razorpayPlanId_uidx" ON "subscription_plans" USING btree ("razorpay_plan_id") WHERE "subscription_plans"."is_deleted" = false;
