ALTER TABLE "testimonial" ADD COLUMN "property_id" text;--> statement-breakpoint
CREATE INDEX "testimonial_property_id_idx" ON "testimonial" USING btree ("property_id");
