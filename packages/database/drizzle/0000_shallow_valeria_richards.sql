CREATE TYPE "public"."business_type" AS ENUM('B2B', 'B2C', 'BOTH', 'GENERAL');--> statement-breakpoint
CREATE TYPE "public"."organization_type" AS ENUM('SELLER', 'DEVELOPER', 'MANAGEMENT', 'APPLICATION');--> statement-breakpoint
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
	"created_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"type" "organization_type" NOT NULL,
	"business_type" "business_type" DEFAULT 'GENERAL',
	"created_at" timestamp NOT NULL,
	"metadata" text,
	"email" text,
	"gst_number" text,
	"phone_number" text,
	"industry" text,
	"company_type" text,
	"is_active" boolean DEFAULT false NOT NULL,
	"razorpay_customer_id" text,
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
	"included_properties" integer DEFAULT 0 NOT NULL,
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
	"currency" text DEFAULT 'INR' NOT NULL,
	"billing_interval" text DEFAULT 'monthly' NOT NULL,
	"razorpay_plan_id" text NOT NULL,
	"total_count" integer,
	"quantity" integer DEFAULT 1 NOT NULL,
	"trial_days" integer DEFAULT 0 NOT NULL,
	"included_properties" integer DEFAULT 0 NOT NULL,
	"addon_property_one_time_cost_in_paise" integer DEFAULT 0 NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text,
	"zone_id" text,
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp,
	"phone_number" text,
	"phone_number_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "region" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "region_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "zone" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"region_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_inviter_id_user_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_subscription" ADD CONSTRAINT "organization_subscription_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_subscription" ADD CONSTRAINT "organization_subscription_subscription_plan_id_subscription_plans_id_fk" FOREIGN KEY ("subscription_plan_id") REFERENCES "public"."subscription_plans"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_active_organization_id_organization_id_fk" FOREIGN KEY ("active_organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_zone_id_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zone"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone" ADD CONSTRAINT "zone_region_id_region_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."region"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "invitation_organizationId_idx" ON "invitation" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "invitation_email_idx" ON "invitation" USING btree ("email");--> statement-breakpoint
CREATE INDEX "member_organizationId_idx" ON "member" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "member_userId_idx" ON "member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "member_organizationId_role_idx" ON "member" USING btree ("organization_id","role");--> statement-breakpoint
CREATE UNIQUE INDEX "organization_slug_uidx" ON "organization" USING btree ("slug");--> statement-breakpoint
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
CREATE UNIQUE INDEX "subscription_plans_code_uidx" ON "subscription_plans" USING btree ("code");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_plans_razorpayPlanId_uidx" ON "subscription_plans" USING btree ("razorpay_plan_id");--> statement-breakpoint
CREATE INDEX "subscription_plans_isActive_idx" ON "subscription_plans" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "user_role_idx" ON "user" USING btree ("role");--> statement-breakpoint
CREATE INDEX "user_zoneId_idx" ON "user" USING btree ("zone_id");--> statement-breakpoint
CREATE UNIQUE INDEX "region_name_uidx" ON "region" USING btree ("name");--> statement-breakpoint
CREATE INDEX "zone_regionId_idx" ON "zone" USING btree ("region_id");--> statement-breakpoint
CREATE UNIQUE INDEX "zone_regionId_name_uidx" ON "zone" USING btree ("region_id","name");