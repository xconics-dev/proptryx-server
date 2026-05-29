CREATE TYPE "public"."notification_audience_panel" AS ENUM('PROPTRYX', 'COMPANY', 'ALL');--> statement-breakpoint
CREATE TYPE "public"."notification_delivery_channel" AS ENUM('DASHBOARD', 'PUSH', 'BOTH');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('QUEUED', 'SENT', 'PARTIAL', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"audience_panel" "notification_audience_panel" DEFAULT 'ALL' NOT NULL,
	"audience_role" text,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"template_key" text,
	"delivery_channel" "notification_delivery_channel" DEFAULT 'BOTH' NOT NULL,
	"push_status" "notification_status" DEFAULT 'QUEUED' NOT NULL,
	"dashboard_status" "notification_status" DEFAULT 'QUEUED' NOT NULL,
	"icon" text,
	"image" text,
	"action_url" text,
	"tag" text,
	"related_entity_type" text,
	"related_entity_id" text,
	"broadcast_id" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"read_at" timestamp,
	"clicked_at" timestamp,
	"sent_at" timestamp,
	"push_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text
);
--> statement-breakpoint
CREATE TABLE "notification_preference" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"email_notifications_enabled" boolean DEFAULT true NOT NULL,
	"dashboard_notifications_enabled" boolean DEFAULT true NOT NULL,
	"push_notifications_enabled" boolean DEFAULT true NOT NULL,
	"browser_permission_prompted_at" timestamp,
	"browser_permission_status" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_push_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"device_id" text,
	"platform" text,
	"browser" text,
	"user_agent" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_template" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"icon" text,
	"image" text,
	"action_url" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text
);
--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preference" ADD CONSTRAINT "notification_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_push_subscription" ADD CONSTRAINT "notification_push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_template" ADD CONSTRAINT "notification_template_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_template" ADD CONSTRAINT "notification_template_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_user_id_created_at_idx" ON "notification" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "notification_user_id_read_at_idx" ON "notification" USING btree ("user_id","read_at");--> statement-breakpoint
CREATE INDEX "notification_broadcast_id_idx" ON "notification" USING btree ("broadcast_id");--> statement-breakpoint
CREATE INDEX "notification_template_key_idx" ON "notification" USING btree ("template_key");--> statement-breakpoint
CREATE INDEX "notification_related_entity_idx" ON "notification" USING btree ("related_entity_type","related_entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_preference_user_id_uidx" ON "notification_preference" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_preference_user_id_idx" ON "notification_preference" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_push_subscription_token_uidx" ON "notification_push_subscription" USING btree ("token");--> statement-breakpoint
CREATE INDEX "notification_push_subscription_user_id_idx" ON "notification_push_subscription" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_push_subscription_user_active_idx" ON "notification_push_subscription" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_template_key_uidx" ON "notification_template" USING btree ("key");--> statement-breakpoint
CREATE INDEX "notification_template_isActive_idx" ON "notification_template" USING btree ("is_active");