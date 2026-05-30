CREATE TABLE "notification_trigger_execution" (
	"id" text PRIMARY KEY NOT NULL,
	"trigger_id" text NOT NULL,
	"source_service" text NOT NULL,
	"resource" text NOT NULL,
	"operation" text NOT NULL,
	"phase" text DEFAULT 'after' NOT NULL,
	"status" text DEFAULT 'success' NOT NULL,
	"recipient_count" integer DEFAULT 0 NOT NULL,
	"dashboard_notification_count" integer DEFAULT 0 NOT NULL,
	"push_subscription_count" integer DEFAULT 0 NOT NULL,
	"related_entity_type" text,
	"related_entity_id" text,
	"error" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"executed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification_trigger_execution" ADD CONSTRAINT "notification_trigger_execution_trigger_id_notification_trigger_id_fk" FOREIGN KEY ("trigger_id") REFERENCES "public"."notification_trigger"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_trigger_execution_trigger_id_idx" ON "notification_trigger_execution" USING btree ("trigger_id","executed_at");--> statement-breakpoint
CREATE INDEX "notification_trigger_execution_resource_operation_idx" ON "notification_trigger_execution" USING btree ("resource","operation","phase");