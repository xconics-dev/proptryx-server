DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM pg_type t
		JOIN pg_namespace n ON n.oid = t.typnamespace
		WHERE n.nspname = 'public'
			AND t.typname = 'organization_type'
	) THEN
		ALTER TYPE "public"."organization_type" ADD VALUE IF NOT EXISTS 'APPLICATION';
	END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.tables
		WHERE table_schema = 'public'
			AND table_name = 'organization'
	)
	AND EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'organization'
			AND column_name = 'business_type'
	) THEN
		EXECUTE 'ALTER TABLE "organization" ALTER COLUMN "business_type" DROP DEFAULT';
		EXECUTE 'ALTER TABLE "organization" ALTER COLUMN "business_type" SET DATA TYPE text USING "business_type"::text';
		EXECUTE 'ALTER TABLE "organization" ALTER COLUMN "business_type" SET DEFAULT ''GENERAL''::text';
	END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.tables
		WHERE table_schema = 'public'
			AND table_name = 'organization'
	)
	AND EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'organization'
			AND column_name = 'company_type'
	) THEN
		EXECUTE 'ALTER TABLE "organization" ALTER COLUMN "company_type" SET DATA TYPE text USING "company_type"::text';
	END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM pg_type t
		JOIN pg_namespace n ON n.oid = t.typnamespace
		WHERE n.nspname = 'public'
			AND t.typname = 'business_type'
	) THEN
		IF EXISTS (
			SELECT 1
			FROM pg_type t
			JOIN pg_namespace n ON n.oid = t.typnamespace
			WHERE n.nspname = 'public'
				AND t.typname = 'business_type_old'
		) THEN
			BEGIN
				EXECUTE 'DROP TYPE "public"."business_type_old"';
			EXCEPTION
				WHEN dependent_objects_still_exist THEN
					NULL;
			END;
		END IF;

		IF NOT EXISTS (
			SELECT 1
			FROM pg_type t
			JOIN pg_namespace n ON n.oid = t.typnamespace
			WHERE n.nspname = 'public'
				AND t.typname = 'business_type_old'
		) THEN
			EXECUTE 'ALTER TYPE "public"."business_type" RENAME TO "business_type_old"';
		END IF;
	END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_type t
		JOIN pg_namespace n ON n.oid = t.typnamespace
		WHERE n.nspname = 'public'
			AND t.typname = 'business_type'
	) THEN
		CREATE TYPE "public"."business_type" AS ENUM('B2B', 'B2C', 'BOTH', 'GENERAL');
	END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.tables
		WHERE table_schema = 'public'
			AND table_name = 'organization'
	) THEN
		IF EXISTS (
			SELECT 1
			FROM information_schema.columns
			WHERE table_schema = 'public'
				AND table_name = 'organization'
				AND column_name = 'business_type'
		) THEN
			EXECUTE '
				ALTER TABLE "organization"
				ALTER COLUMN "business_type" SET DATA TYPE "public"."business_type"
				USING (
					CASE
						WHEN "business_type" IS NULL THEN NULL
						WHEN "business_type" IN (''B2B'', ''B2C'', ''BOTH'', ''GENERAL'') THEN "business_type"::"public"."business_type"
						ELSE ''GENERAL''::"public"."business_type"
					END
				)';
			EXECUTE 'ALTER TABLE "organization" ALTER COLUMN "business_type" SET DEFAULT ''GENERAL''::"public"."business_type"';
		ELSE
			EXECUTE 'ALTER TABLE "organization" ADD COLUMN "business_type" "public"."business_type" DEFAULT ''GENERAL''';
		END IF;
	END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
	IF EXISTS (
		SELECT 1
		FROM pg_type t
		JOIN pg_namespace n ON n.oid = t.typnamespace
		WHERE n.nspname = 'public'
			AND t.typname = 'business_type_old'
	) THEN
		BEGIN
			EXECUTE 'DROP TYPE "public"."business_type_old"';
		EXCEPTION
			WHEN dependent_objects_still_exist THEN
				NULL;
		END;
	END IF;

	IF EXISTS (
		SELECT 1
		FROM pg_type t
		JOIN pg_namespace n ON n.oid = t.typnamespace
		WHERE n.nspname = 'public'
			AND t.typname = 'company_type'
	) THEN
		BEGIN
			EXECUTE 'DROP TYPE "public"."company_type"';
		EXCEPTION
			WHEN dependent_objects_still_exist THEN
				NULL;
		END;
	END IF;
END $$;