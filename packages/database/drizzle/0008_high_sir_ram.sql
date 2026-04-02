ALTER TABLE "region" ADD COLUMN "created_by_user" text;--> statement-breakpoint
ALTER TABLE "region" ADD COLUMN "updated_by_user" text;--> statement-breakpoint
ALTER TABLE "zone" ADD COLUMN "created_by_user" text;--> statement-breakpoint
ALTER TABLE "zone" ADD COLUMN "updated_by_user" text;--> statement-breakpoint
ALTER TABLE "region" ADD CONSTRAINT "region_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "region" ADD CONSTRAINT "region_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone" ADD CONSTRAINT "zone_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zone" ADD CONSTRAINT "zone_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;