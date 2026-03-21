CREATE TABLE "company_request" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_name" text NOT NULL,
	"owner_email" text NOT NULL,
	"owner_phone" text NOT NULL,
	"company_gst_number" text NOT NULL,
	"company_email" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "company_request_gst_number_uidx" ON "company_request" USING btree ("company_gst_number");