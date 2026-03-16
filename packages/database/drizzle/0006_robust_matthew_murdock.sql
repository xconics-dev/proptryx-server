CREATE TABLE "subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"plan" text NOT NULL,
	"reference_id" text NOT NULL,
	"razorpay_customer_id" text,
	"razorpay_subscription_id" text,
	"razorpay_plan_id" text,
	"status" text DEFAULT 'created' NOT NULL,
	"current_start" timestamp,
	"current_end" timestamp,
	"ended_at" timestamp,
	"quantity" integer DEFAULT 1,
	"total_count" integer,
	"paid_count" integer DEFAULT 0,
	"remaining_count" integer,
	"cancelled_at" timestamp,
	"paused_at" timestamp,
	"short_url" text,
	"cancel_at_cycle_end" boolean DEFAULT false,
	"group_id" text,
	"billing_period" text,
	"trial_start" timestamp,
	"trial_end" timestamp,
	"metadata" text,
	"renewed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "subscription_referenceId_idx" ON "subscription" USING btree ("reference_id");--> statement-breakpoint
CREATE INDEX "subscription_referenceId_groupId_idx" ON "subscription" USING btree ("reference_id","group_id");--> statement-breakpoint
CREATE INDEX "subscription_razorpayCustomerId_idx" ON "subscription" USING btree ("razorpay_customer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "subscription_razorpaySubscriptionId_uidx" ON "subscription" USING btree ("razorpay_subscription_id");--> statement-breakpoint
CREATE INDEX "subscription_status_idx" ON "subscription" USING btree ("status");--> statement-breakpoint
CREATE INDEX "organization_razorpayCustomerId_idx" ON "organization" USING btree ("razorpay_customer_id");