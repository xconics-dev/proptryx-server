CREATE TABLE "property" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"country" text NOT NULL,
	"state" text NOT NULL,
	"city" text NOT NULL,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"pincode" text NOT NULL,
	"latitude" real,
	"longitude" real,
	"location_metadata" jsonb DEFAULT '{"distances":{"airportKm":0,"railwayKm":0,"highwayKm":0,"commercialHubKm":0,"competitionKm":0},"roadWidthFt":0}'::jsonb NOT NULL,
	"thumbnail" text,
	"images" text[] DEFAULT '{}' NOT NULL,
	"documents" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"type" "property_type" NOT NULL,
	"status" "property_status" NOT NULL,
	"super_owner_id" text,
	"created_by_user" text,
	"updated_by_user" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"deleted_at" timestamp,
	"deleted_by_user" text
);
--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_super_owner_id_user_id_fk" FOREIGN KEY ("super_owner_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property" ADD CONSTRAINT "property_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_name_idx" ON "property" USING btree ("name");--> statement-breakpoint
CREATE INDEX "property_superOwnerId_idx" ON "property" USING btree ("super_owner_id");--> statement-breakpoint
CREATE INDEX "property_type_idx" ON "property" USING btree ("type");--> statement-breakpoint
CREATE INDEX "property_status_idx" ON "property" USING btree ("status");--> statement-breakpoint
CREATE INDEX "property_city_idx" ON "property" USING btree ("city");--> statement-breakpoint
CREATE INDEX "property_pincode_idx" ON "property" USING btree ("pincode");--> statement-breakpoint
CREATE INDEX "property_isDeleted_isPublished_createdAt_idx" ON "property" USING btree ("is_deleted","is_published","created_at");