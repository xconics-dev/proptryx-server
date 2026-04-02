ALTER TABLE "member" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "created_by_user" text;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "updated_by_user" text;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "is_deleted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "member" ADD COLUMN "deleted_by_user" text;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_created_by_user_user_id_fk" FOREIGN KEY ("created_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_updated_by_user_user_id_fk" FOREIGN KEY ("updated_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "member" ADD CONSTRAINT "member_deleted_by_user_user_id_fk" FOREIGN KEY ("deleted_by_user") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;