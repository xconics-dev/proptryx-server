ALTER TABLE "property_zone" DROP CONSTRAINT "property_zone_propertyId_unique";--> statement-breakpoint
ALTER TABLE "property_zone" ADD COLUMN "created_by_user" text;--> statement-breakpoint
ALTER TABLE "property_zone" ADD COLUMN "updated_by_user" text;--> statement-breakpoint
ALTER TABLE "property_zone" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "property_zone" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "property_zone" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "property_zone" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "property_zone" ADD COLUMN "deleted_by_user" text;--> statement-breakpoint
ALTER TABLE "property_zone" ADD CONSTRAINT "property_zone_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_zone" ADD CONSTRAINT "property_zone_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_zone" ADD CONSTRAINT "property_zone_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_zone_propertyId_idx" ON "property_zone" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "property_zone_isDeleted_propertyId_idx" ON "property_zone" USING btree ("is_deleted","property_id");--> statement-breakpoint
ALTER TABLE "property_zone" ADD CONSTRAINT "property_zone_propertyId_zoneId_unique" UNIQUE("property_id","zone_id");