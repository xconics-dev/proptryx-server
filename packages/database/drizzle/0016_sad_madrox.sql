CREATE TYPE "public"."meeting_status" AS ENUM('SCHEDULED', 'SITE_VISIT', 'PROPERTY_DETAILS_APPROVED', 'IN_PROGRESS', 'ACCEPTED', 'REJECTED', 'ON_HOLD');--> statement-breakpoint
CREATE TABLE "meeting" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" "meeting_status" DEFAULT 'SCHEDULED' NOT NULL,
	"mom" text,
	"scheduled_at" timestamp DEFAULT now() NOT NULL,
	"buyer_id" text,
	"property_id" uuid NOT NULL,
	"seller_id" text,
	"created_by_user" text,
	"updated_by_user" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_user" text
);
--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_buyer_id_user_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_seller_id_user_id_fk" FOREIGN KEY ("seller_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meeting" ADD CONSTRAINT "meeting_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meeting_propertyId_idx" ON "meeting" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "meeting_buyerId_idx" ON "meeting" USING btree ("buyer_id");--> statement-breakpoint
CREATE INDEX "meeting_sellerId_idx" ON "meeting" USING btree ("seller_id");--> statement-breakpoint
CREATE INDEX "meeting_status_idx" ON "meeting" USING btree ("status");--> statement-breakpoint
CREATE INDEX "meeting_scheduledAt_idx" ON "meeting" USING btree ("scheduled_at");--> statement-breakpoint
CREATE INDEX "meeting_isDeleted_status_scheduledAt_idx" ON "meeting" USING btree ("is_deleted","status","scheduled_at");