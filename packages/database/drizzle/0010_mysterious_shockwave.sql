CREATE TYPE "public"."property_status" AS ENUM('VACANT', 'BUILD_TO_SUITE', 'READY_TO_MOVE', 'UNDER_NEGOTIATION', 'BOOKED', 'CLOSED', 'ON_HOLD');--> statement-breakpoint
CREATE TYPE "public"."property_type" AS ENUM('RETAIL', 'OFFICE', 'WAREHOUSE', 'COMMERCIAL_PARKING');--> statement-breakpoint
CREATE TABLE "testimonial" (
	"id" text PRIMARY KEY NOT NULL,
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
ALTER TABLE "company_request" ADD COLUMN "created_by_user" text;--> statement-breakpoint
ALTER TABLE "company_request" ADD COLUMN "updated_by_user" text;--> statement-breakpoint
ALTER TABLE "testimonial" ADD CONSTRAINT "testimonial_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonial" ADD CONSTRAINT "testimonial_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "testimonial" ADD CONSTRAINT "testimonial_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "testimonial_author_name_idx" ON "testimonial" USING btree ("author_name");--> statement-breakpoint
CREATE INDEX "testimonial_isDeleted_isArchived_createdAt_idx" ON "testimonial" USING btree ("is_deleted","is_archived","created_at");--> statement-breakpoint
ALTER TABLE "company_request" ADD CONSTRAINT "company_request_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_request" ADD CONSTRAINT "company_request_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_request_owner_email_idx" ON "company_request" USING btree ("owner_email");--> statement-breakpoint
CREATE INDEX "company_request_owner_phone_idx" ON "company_request" USING btree ("owner_phone");--> statement-breakpoint
CREATE INDEX "company_request_isDeleted_createdAt_idx" ON "company_request" USING btree ("is_deleted","created_at");