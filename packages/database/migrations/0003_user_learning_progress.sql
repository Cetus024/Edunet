CREATE TABLE "onboarding_profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"learning_source" text NOT NULL,
	"material_name" text,
	"material_type" text,
	"material_size" integer,
	"material_last_modified" bigint,
	"recording_duration_seconds" integer,
	"recording_mime_type" text,
	"subject_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"familiarity" text NOT NULL,
	"initial_memory_score" real NOT NULL,
	"completed_at" timestamp NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile" (
	"user_id" text PRIMARY KEY NOT NULL,
	"role" text NOT NULL,
	"school_id" text NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"onboarding_completed_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempt_answer" (
	"attempt_id" text NOT NULL,
	"question_key" text NOT NULL,
	"question_index" integer NOT NULL,
	"submitted_answer" text NOT NULL,
	"is_correct" boolean NOT NULL,
	CONSTRAINT "quiz_attempt_answer_attempt_id_question_key_pk" PRIMARY KEY("attempt_id","question_key")
);
--> statement-breakpoint
CREATE TABLE "quiz_attempt" (
	"id" text PRIMARY KEY NOT NULL,
	"submission_id" text NOT NULL,
	"user_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"quiz_mode" text NOT NULL,
	"question_set_version" text NOT NULL,
	"correct_answers" integer NOT NULL,
	"total_questions" integer NOT NULL,
	"percent_correct" real NOT NULL,
	"resulting_memory_score" real NOT NULL,
	"started_at" timestamp,
	"submitted_at" timestamp NOT NULL,
	CONSTRAINT "quiz_attempt_submission_id_unique" UNIQUE("submission_id")
);
--> statement-breakpoint
CREATE TABLE "user_topic_progress" (
	"user_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"memory_score" real NOT NULL,
	"last_reviewed_at" timestamp NOT NULL,
	"next_review_at" timestamp NOT NULL,
	"quiz_attempts" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_topic_progress_user_id_topic_id_pk" PRIMARY KEY("user_id","topic_id")
);
--> statement-breakpoint
ALTER TABLE "onboarding_profile" ADD CONSTRAINT "onboarding_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_profile" ADD CONSTRAINT "onboarding_profile_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_profile" ADD CONSTRAINT "onboarding_profile_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt_answer" ADD CONSTRAINT "quiz_attempt_answer_attempt_id_quiz_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD CONSTRAINT "quiz_attempt_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_topic_progress" ADD CONSTRAINT "user_topic_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_topic_progress" ADD CONSTRAINT "user_topic_progress_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;