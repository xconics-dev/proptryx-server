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
	"sort_order" integer DEFAULT 0 NOT NULL,
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
INSERT INTO "property_media" (
	"property_id",
	"media_type",
	"name",
	"storage_key",
	"url",
	"mime_type",
	"size_bytes",
	"visibility",
	"sort_order",
	"alt_text",
	"is_thumbnail",
	"created_by_user",
	"updated_by_user",
	"created_at",
	"updated_at",
	"is_deleted",
	"deleted_at",
	"deleted_by_user"
)
SELECT
	p."id",
	'IMAGE',
	COALESCE(NULLIF(regexp_replace(p."thumbnail", '^.*/', ''), ''), 'thumbnail'),
	p."thumbnail",
	p."thumbnail",
	NULL,
	NULL,
	'PUBLIC',
	0,
	NULL,
	TRUE,
	p."created_by_user",
	p."updated_by_user",
	p."created_at",
	p."updated_at",
	p."is_deleted",
	p."deleted_at",
	p."deleted_by_user"
FROM "property" p
WHERE p."thumbnail" IS NOT NULL;--> statement-breakpoint
INSERT INTO "property_media" (
	"property_id",
	"media_type",
	"name",
	"storage_key",
	"url",
	"mime_type",
	"size_bytes",
	"visibility",
	"sort_order",
	"alt_text",
	"is_thumbnail",
	"created_by_user",
	"updated_by_user",
	"created_at",
	"updated_at",
	"is_deleted",
	"deleted_at",
	"deleted_by_user"
)
SELECT
	p."id",
	'IMAGE',
	COALESCE(
		NULLIF(regexp_replace(img."image_url", '^.*/', ''), ''),
		'image'
	),
	img."image_url",
	img."image_url",
	NULL,
	NULL,
	'PUBLIC',
	img."ord",
	NULL,
	FALSE,
	p."created_by_user",
	p."updated_by_user",
	p."created_at",
	p."updated_at",
	p."is_deleted",
	p."deleted_at",
	p."deleted_by_user"
FROM "property" p
CROSS JOIN LATERAL unnest(COALESCE(p."images", '{}'::text[])) WITH ORDINALITY AS img("image_url", "ord")
WHERE p."thumbnail" IS NULL OR img."image_url" <> p."thumbnail";--> statement-breakpoint
INSERT INTO "property_media" (
	"property_id",
	"media_type",
	"name",
	"storage_key",
	"url",
	"mime_type",
	"size_bytes",
	"visibility",
	"sort_order",
	"alt_text",
	"is_thumbnail",
	"created_by_user",
	"updated_by_user",
	"created_at",
	"updated_at",
	"is_deleted",
	"deleted_at",
	"deleted_by_user"
)
SELECT
	p."id",
	'DOCUMENT',
	COALESCE(
		NULLIF(doc."document"->>'name', ''),
		COALESCE(NULLIF(regexp_replace(doc."document"->>'url', '^.*/', ''), ''), 'document-' || doc."ord"::text)
	),
	doc."document"->>'url',
	doc."document"->>'url',
	NULL,
	NULL,
	COALESCE(NULLIF(upper(doc."document"->>'visibility'), ''), 'PUBLIC'),
	doc."ord",
	NULL,
	FALSE,
	p."created_by_user",
	p."updated_by_user",
	p."created_at",
	p."updated_at",
	p."is_deleted",
	p."deleted_at",
	p."deleted_by_user"
FROM "property" p
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p."documents", '[]'::jsonb)) WITH ORDINALITY AS doc("document", "ord");--> statement-breakpoint
ALTER TABLE "property" DROP COLUMN "thumbnail";--> statement-breakpoint
ALTER TABLE "property" DROP COLUMN "images";--> statement-breakpoint
ALTER TABLE "property" DROP COLUMN "documents";--> statement-breakpoint
