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
ALTER TABLE "broker_request" ADD CONSTRAINT "broker_request_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_request" ADD CONSTRAINT "broker_request_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "broker_request" ADD CONSTRAINT "broker_request_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "broker_request_email_idx" ON "broker_request" USING btree ("email");--> statement-breakpoint
CREATE INDEX "broker_request_phone_idx" ON "broker_request" USING btree ("phone_number");--> statement-breakpoint
CREATE INDEX "broker_request_isDeleted_createdAt_idx" ON "broker_request" USING btree ("is_deleted","created_at");--> statement-breakpoint
CREATE INDEX "broker_request_name_trgm_idx" ON "broker_request" USING gin (lower("name") gin_trgm_ops) WHERE "broker_request"."is_deleted" = false;--> statement-breakpoint
CREATE INDEX "broker_request_email_trgm_idx" ON "broker_request" USING gin (lower("email") gin_trgm_ops) WHERE "broker_request"."is_deleted" = false;--> statement-breakpoint
CREATE INDEX "broker_request_phone_trgm_idx" ON "broker_request" USING gin (lower("phone_number") gin_trgm_ops) WHERE "broker_request"."is_deleted" = false;