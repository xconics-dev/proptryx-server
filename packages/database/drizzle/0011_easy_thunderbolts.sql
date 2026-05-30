CREATE TABLE "notification_trigger" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"source_service" text NOT NULL,
	"resource" text NOT NULL,
	"operation" text NOT NULL,
	"phase" text DEFAULT 'after' NOT NULL,
	"delivery_channel" "notification_delivery_channel" DEFAULT 'BOTH' NOT NULL,
	"audience_panel" "notification_audience_panel" DEFAULT 'ALL' NOT NULL,
	"audience_role" text,
	"audience_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recipient_strategy" text DEFAULT 'resource_owner' NOT NULL,
	"template_key" text,
	"title" text,
	"body" text,
	"icon" text,
	"image" text,
	"action_url" text,
	"tag" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"conditions" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by_user" text,
	"updated_by_user" text
);
--> statement-breakpoint
ALTER TABLE "notification_trigger" ADD CONSTRAINT "notification_trigger_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_trigger" ADD CONSTRAINT "notification_trigger_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_trigger_key_uidx" ON "notification_trigger" USING btree ("key");--> statement-breakpoint
CREATE INDEX "notification_trigger_resource_operation_phase_idx" ON "notification_trigger" USING btree ("resource","operation","phase","is_active");--> statement-breakpoint
CREATE INDEX "notification_trigger_template_key_idx" ON "notification_trigger" USING btree ("template_key");--> statement-breakpoint
CREATE INDEX "notification_trigger_isActive_idx" ON "notification_trigger" USING btree ("is_active");