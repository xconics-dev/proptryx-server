ALTER TABLE "region" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "region" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "region" ADD COLUMN "deleted_by_user" text;--> statement-breakpoint
ALTER TABLE "zone" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "zone" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "zone" ADD COLUMN "deleted_by_user" text;--> statement-breakpoint
ALTER TABLE "region" ADD CONSTRAINT "region_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone" ADD CONSTRAINT "zone_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;