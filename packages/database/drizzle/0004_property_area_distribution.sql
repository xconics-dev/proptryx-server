ALTER TABLE "property" ADD COLUMN "area_distribution" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "property_owner" ADD COLUMN "distribution_block_id" text;
ALTER TABLE "property_owner_temporary" ADD COLUMN "distribution_block_id" text;
