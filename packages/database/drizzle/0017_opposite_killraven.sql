CREATE TABLE "property_region" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"zone_id" text NOT NULL,
	CONSTRAINT "property_region_propertyId_unique" UNIQUE("property_id")
);
--> statement-breakpoint
ALTER TABLE "property_region" ADD CONSTRAINT "property_region_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_region" ADD CONSTRAINT "property_region_zone_id_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_region_zoneId_idx" ON "property_region" USING btree ("zone_id");