-- Recovery migration: some deployed databases contain a later migration
-- marker that caused 0019/0020 to be skipped. Every operation below is
-- idempotent so fresh databases and already-correct databases are unchanged.
ALTER TABLE public."user" ADD COLUMN IF NOT EXISTS "class" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE public."onboarding_profile" ALTER COLUMN "subject_id" DROP NOT NULL;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public."school_class" (
	"id" text PRIMARY KEY NOT NULL,
	"school_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public."student_class_assignment" (
	"student_user_id" text PRIMARY KEY NOT NULL,
	"class_id" text NOT NULL,
	"assigned_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE public."teaching_scope" ADD COLUMN IF NOT EXISTS "class_id" text;--> statement-breakpoint
INSERT INTO public."school_class" ("id", "school_id", "name", "created_at", "updated_at")
SELECT
	'legacy-class-' || md5("school_id" || ':' || lower(trim("classroom_name"))),
	"school_id",
	min(trim("classroom_name")),
	min("created_at"),
	max("updated_at")
FROM public."teaching_scope"
GROUP BY "school_id", lower(trim("classroom_name"))
ON CONFLICT ("id") DO NOTHING;--> statement-breakpoint
UPDATE public."teaching_scope" AS "scope"
SET "class_id" = "class"."id"
FROM public."school_class" AS "class"
WHERE "scope"."class_id" IS NULL
	AND "class"."school_id" = "scope"."school_id"
	AND lower("class"."name") = lower(trim("scope"."classroom_name"));--> statement-breakpoint
ALTER TABLE public."teaching_scope" ALTER COLUMN "class_id" SET NOT NULL;--> statement-breakpoint
DO $migration$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'school_class_school_id_schools_id_fk'
			AND conrelid = 'public.school_class'::regclass
	) THEN
		ALTER TABLE public."school_class"
			ADD CONSTRAINT "school_class_school_id_schools_id_fk"
			FOREIGN KEY ("school_id") REFERENCES public."schools"("id") ON DELETE restrict;
	END IF;
END $migration$;--> statement-breakpoint
DO $migration$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'student_class_assignment_student_user_id_user_id_fk'
			AND conrelid = 'public.student_class_assignment'::regclass
	) THEN
		ALTER TABLE public."student_class_assignment"
			ADD CONSTRAINT "student_class_assignment_student_user_id_user_id_fk"
			FOREIGN KEY ("student_user_id") REFERENCES public."user"("id") ON DELETE cascade;
	END IF;
END $migration$;--> statement-breakpoint
DO $migration$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'student_class_assignment_class_id_school_class_id_fk'
			AND conrelid = 'public.student_class_assignment'::regclass
	) THEN
		ALTER TABLE public."student_class_assignment"
			ADD CONSTRAINT "student_class_assignment_class_id_school_class_id_fk"
			FOREIGN KEY ("class_id") REFERENCES public."school_class"("id") ON DELETE restrict;
	END IF;
END $migration$;--> statement-breakpoint
DO $migration$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM pg_constraint
		WHERE conname = 'teaching_scope_class_id_school_class_id_fk'
			AND conrelid = 'public.teaching_scope'::regclass
	) THEN
		ALTER TABLE public."teaching_scope"
			ADD CONSTRAINT "teaching_scope_class_id_school_class_id_fk"
			FOREIGN KEY ("class_id") REFERENCES public."school_class"("id") ON DELETE restrict;
	END IF;
END $migration$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "school_class_school_name_uidx"
	ON public."school_class" USING btree ("school_id", lower("name"));--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "teaching_scope_teacher_class_subject_uidx"
	ON public."teaching_scope" USING btree ("user_id", "class_id", "subject_id");--> statement-breakpoint
INSERT INTO public."student_class_assignment" ("student_user_id", "class_id")
SELECT "student_user_id", min("class_id")
FROM (
	SELECT "enrollment"."student_user_id", "scope"."class_id"
	FROM public."classroom_enrollment" AS "enrollment"
	INNER JOIN public."teaching_scope" AS "scope" ON "scope"."id" = "enrollment"."teaching_scope_id"
	INNER JOIN public."profile" ON "profile"."user_id" = "enrollment"."student_user_id"
	INNER JOIN public."school_class" AS "class" ON "class"."id" = "scope"."class_id"
	WHERE "profile"."role" = 'student'
		AND "profile"."school_id" = "class"."school_id"
) AS "legacy_enrollment_classes"
GROUP BY "student_user_id"
HAVING count(DISTINCT "class_id") = 1
ON CONFLICT ("student_user_id") DO NOTHING;--> statement-breakpoint
INSERT INTO public."student_class_assignment" ("student_user_id", "class_id")
SELECT "profile"."user_id", "class"."id"
FROM public."profile"
INNER JOIN public."user" ON "user"."id" = "profile"."user_id"
INNER JOIN public."school_class" AS "class"
	ON "class"."school_id" = "profile"."school_id"
	AND lower(trim("class"."name")) = lower(trim("user"."class"))
WHERE "profile"."role" = 'student'
	AND trim("user"."class") <> ''
ON CONFLICT ("student_user_id") DO NOTHING;--> statement-breakpoint
INSERT INTO public."student_class_assignment" ("student_user_id", "class_id")
SELECT "candidate"."student_user_id", min("candidate"."class_id")
FROM (
	SELECT DISTINCT
		"profile"."user_id" AS "student_user_id",
		"scope"."class_id"
	FROM public."profile"
	INNER JOIN public."onboarding_profile" ON "onboarding_profile"."user_id" = "profile"."user_id"
	INNER JOIN public."teaching_scope" AS "scope"
		ON "scope"."school_id" = "profile"."school_id"
		AND "scope"."subject_id" = "onboarding_profile"."subject_id"
	WHERE "profile"."role" = 'student'
) AS "candidate"
GROUP BY "candidate"."student_user_id"
HAVING count(DISTINCT "candidate"."class_id") = 1
ON CONFLICT ("student_user_id") DO NOTHING;
