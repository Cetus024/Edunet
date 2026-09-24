CREATE TABLE "teaching_scope" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"school_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"classroom_name" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "teaching_scope" ADD CONSTRAINT "teaching_scope_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_scope" ADD CONSTRAINT "teaching_scope_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_scope" ADD CONSTRAINT "teaching_scope_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
INSERT INTO "teaching_scope" ("id", "user_id", "school_id", "subject_id", "classroom_name", "position")
SELECT
	'legacy-' || md5(p."user_id" || ':' || op."subject_id"),
	p."user_id",
	p."school_id",
	op."subject_id",
	s."name" || ' class',
	0
FROM "profile" p
INNER JOIN "onboarding_profile" op ON op."user_id" = p."user_id"
INNER JOIN "subjects" s ON s."id" = op."subject_id"
WHERE p."role" IN ('teacher', 'tutor');
