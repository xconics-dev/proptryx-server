ALTER TABLE "property" ALTER COLUMN "id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "property" ALTER COLUMN "id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "faq" ALTER COLUMN "property_id" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "testimonial" ADD COLUMN "property_id" text;--> statement-breakpoint
CREATE INDEX "testimonial_property_id_idx" ON "testimonial" USING btree ("property_id");