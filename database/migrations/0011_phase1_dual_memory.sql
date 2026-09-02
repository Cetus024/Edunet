CREATE TABLE "user_topic_mode_progress" (
	"user_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"assessment_mode" text NOT NULL,
	"mastery" double precision NOT NULL,
	"last_updated_at" timestamp NOT NULL,
	"quiz_attempts" integer DEFAULT 0 NOT NULL,
	"model_version" text DEFAULT 'phase1-v1' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_topic_mode_progress_user_id_topic_id_assessment_mode_pk" PRIMARY KEY("user_id","topic_id","assessment_mode"),
	CONSTRAINT "user_topic_mode_progress_mode_check" CHECK ("user_topic_mode_progress"."assessment_mode" in ('mcq', 'essay')),
	CONSTRAINT "user_topic_mode_progress_mastery_check" CHECK ("user_topic_mode_progress"."mastery" >= 0 and "user_topic_mode_progress"."mastery" <= 1)
);
--> statement-breakpoint
UPDATE "onboarding_profile"
SET "initial_memory_score" = NULL,
	"placement_attempt_id" = NULL;--> statement-breakpoint
DELETE FROM "quiz_attempt";--> statement-breakpoint
DELETE FROM "user_topic_progress";--> statement-breakpoint
ALTER TABLE "user_topic_progress" DROP CONSTRAINT "user_topic_progress_mastery_check";--> statement-breakpoint
ALTER TABLE "user_topic_progress" DROP CONSTRAINT "user_topic_progress_stability_check";--> statement-breakpoint
ALTER TABLE "user_topic_progress" DROP CONSTRAINT "user_topic_progress_successful_reviews_check";--> statement-breakpoint
DROP INDEX "quiz_attempt_one_active_speed_topic_idx";--> statement-breakpoint
ALTER TABLE "quiz_attempt_answer" ALTER COLUMN "is_correct" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ALTER COLUMN "model_version" SET DEFAULT 'phase1-v1';--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "max_marks" integer;--> statement-breakpoint
UPDATE "quiz_questions" SET "max_marks" = 10 WHERE "type" = 'structured';--> statement-breakpoint
ALTER TABLE "quiz_attempt_answer" ADD COLUMN "marks_obtained" double precision;--> statement-breakpoint
ALTER TABLE "quiz_attempt_answer" ADD COLUMN "maximum_marks" double precision;--> statement-breakpoint
ALTER TABLE "quiz_attempt_question" ADD COLUMN "max_marks" integer;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD COLUMN "prior_mastery" double precision;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD COLUMN "prior_elapsed_days" double precision;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD COLUMN "posterior_mastery" double precision;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD COLUMN "marks_obtained" double precision;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD COLUMN "maximum_marks" double precision;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD COLUMN "feedback_status" text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD COLUMN "calculation_trace" jsonb;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD COLUMN "feedback_completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD COLUMN "feedback_skipped_at" timestamp;--> statement-breakpoint
ALTER TABLE "user_topic_progress" ADD COLUMN "next_review_at" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "user_topic_progress" ADD COLUMN "reminder_calculated_at" timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE "user_topic_mode_progress" ADD CONSTRAINT "user_topic_mode_progress_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_topic_mode_progress" ADD CONSTRAINT "user_topic_mode_progress_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_attempt_one_active_topic_idx" ON "quiz_attempt" USING btree ("user_id","topic_id") WHERE "quiz_attempt"."status" = 'in_progress';--> statement-breakpoint
ALTER TABLE "quiz_attempt_answer" DROP COLUMN "prior_mastery";--> statement-breakpoint
ALTER TABLE "quiz_attempt_answer" DROP COLUMN "posterior_mastery";--> statement-breakpoint
ALTER TABLE "quiz_attempt_answer" DROP COLUMN "mastery_after_transition";--> statement-breakpoint
ALTER TABLE "quiz_attempt_answer" DROP COLUMN "predicted_correctness";--> statement-breakpoint
ALTER TABLE "quiz_attempt_answer" DROP COLUMN "calculation_trace";--> statement-breakpoint
ALTER TABLE "quiz_attempt" DROP COLUMN "stability_before";--> statement-breakpoint
ALTER TABLE "quiz_attempt" DROP COLUMN "stability_after";--> statement-breakpoint
ALTER TABLE "quiz_attempt" DROP COLUMN "successful_reviews_before";--> statement-breakpoint
ALTER TABLE "quiz_attempt" DROP COLUMN "successful_reviews_after";--> statement-breakpoint
ALTER TABLE "user_topic_progress" DROP COLUMN "mastery";--> statement-breakpoint
ALTER TABLE "user_topic_progress" DROP COLUMN "stability_days";--> statement-breakpoint
ALTER TABLE "user_topic_progress" DROP COLUMN "successful_reviews";--> statement-breakpoint
ALTER TABLE "user_topic_progress" DROP COLUMN "model_version";--> statement-breakpoint
ALTER TABLE "user_topic_progress" DROP COLUMN "last_reviewed_at";--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_max_marks_check" CHECK (("quiz_questions"."type" = 'structured' and "quiz_questions"."max_marks" = 10) or ("quiz_questions"."type" <> 'structured' and "quiz_questions"."max_marks" is null));--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD CONSTRAINT "quiz_attempt_mode_check" CHECK ("quiz_attempt"."quiz_mode" in ('mcq', 'essay', 'placement'));--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD CONSTRAINT "quiz_attempt_feedback_status_check" CHECK ("quiz_attempt"."feedback_status" in ('pending', 'completed', 'skipped'));
