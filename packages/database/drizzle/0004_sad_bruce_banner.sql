ALTER TABLE "faq" ADD COLUMN "property_id" uuid;--> statement-breakpoint
ALTER TABLE "faq" ADD CONSTRAINT "faq_property_id_property_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."property"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "faq_property_id_idx" ON "faq" USING btree ("property_id");