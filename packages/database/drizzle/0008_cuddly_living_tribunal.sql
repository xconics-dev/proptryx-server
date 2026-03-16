CREATE TABLE "subscription_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"rz_plan_id" text NOT NULL,
	"rz_annual_plan_id" text,
	"description" text,
	"group" text,
	"total_count" integer,
	"quantity" integer,
	"free_trial_days" integer,
	"features" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_plan_rzPlanId_uidx" ON "subscription_plan" USING btree ("rz_plan_id");--> statement-breakpoint
CREATE INDEX "subscription_plan_isActive_idx" ON "subscription_plan" USING btree ("is_active");