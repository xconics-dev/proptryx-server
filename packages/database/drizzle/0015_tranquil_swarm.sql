CREATE TYPE "public"."property_media_type" AS ENUM('IMAGE', 'DOCUMENT');--> statement-breakpoint
CREATE TYPE "public"."property_media_visibility" AS ENUM('PUBLIC', 'PRIVATE');--> statement-breakpoint
CREATE TABLE "property_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"media_type" "property_media_type" NOT NULL,
	"name" text NOT NULL,
	"storage_key" text NOT NULL,
	"url" text NOT NULL,
	"mime_type" text,
	"size_bytes" integer,
	"visibility" "property_media_visibility" DEFAULT 'PUBLIC' NOT NULL,
	"sort_order" integer DEFAULT 0,
	"alt_text" text,
	"is_thumbnail" boolean DEFAULT false NOT NULL,
	"created_by_user" text,
	"updated_by_user" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_user" text
);
--> statement-breakpoint
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_media" ADD CONSTRAINT "property_media_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_media_propertyId_idx" ON "property_media" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_media_propertyId_mediaType_idx" ON "property_media" USING btree ("property_id","media_type");--> statement-breakpoint
CREATE INDEX "property_media_propertyId_isThumbnail_idx" ON "property_media" USING btree ("property_id","is_thumbnail");--> statement-breakpoint
CREATE INDEX "property_media_isDeleted_propertyId_idx" ON "property_media" USING btree ("is_deleted","property_id");--> statement-breakpoint
ALTER TABLE "property" DROP COLUMN "thumbnail";--> statement-breakpoint
ALTER TABLE "property" DROP COLUMN "images";--> statement-breakpoint
ALTER TABLE "property" DROP COLUMN "documents";