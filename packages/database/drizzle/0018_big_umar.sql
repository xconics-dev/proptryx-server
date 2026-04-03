ALTER TABLE "property_region" RENAME TO "property_zone";--> statement-breakpoint
ALTER TABLE "property_zone" DROP CONSTRAINT "property_region_propertyId_unique";--> statement-breakpoint
ALTER TABLE "property_zone" DROP CONSTRAINT "property_region_property_id_property_id_fk";
--> statement-breakpoint
ALTER TABLE "property_zone" DROP CONSTRAINT "property_region_zone_id_zone_id_fk";
--> statement-breakpoint
DROP INDEX "property_region_zoneId_idx";--> statement-breakpoint
ALTER TABLE "property_zone" ADD CONSTRAINT "property_zone_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "property_zone" ADD CONSTRAINT "property_zone_zone_id_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zone"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "property_zone_zoneId_idx" ON "property_zone" USING btree ("zone_id");--> statement-breakpoint
ALTER TABLE "property_zone" ADD CONSTRAINT "property_zone_propertyId_unique" UNIQUE("property_id");