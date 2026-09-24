CREATE TABLE "classroom_enrollment" (
	"teaching_scope_id" text NOT NULL,
	"student_user_id" text NOT NULL,
	"added_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "classroom_enrollment_teaching_scope_id_student_user_id_pk" PRIMARY KEY("teaching_scope_id","student_user_id")
);
--> statement-breakpoint
ALTER TABLE "classroom_enrollment" ADD CONSTRAINT "classroom_enrollment_teaching_scope_id_teaching_scope_id_fk" FOREIGN KEY ("teaching_scope_id") REFERENCES "public"."teaching_scope"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "classroom_enrollment" ADD CONSTRAINT "classroom_enrollment_student_user_id_user_id_fk" FOREIGN KEY ("student_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;