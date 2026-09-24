CREATE TABLE "quiz_attempt_question" (
	"attempt_id" text NOT NULL,
	"question_index" integer NOT NULL,
	"question_key" text NOT NULL,
	"type" text NOT NULL,
	"topic" text NOT NULL,
	"text" text NOT NULL,
	"options" jsonb,
	"correct_answer" jsonb NOT NULL,
	"explanation" text NOT NULL,
	"linked_concept" text NOT NULL,
	"source" text,
	"resource_number" text,
	CONSTRAINT "quiz_attempt_question_attempt_id_question_index_pk" PRIMARY KEY("attempt_id","question_index")
);
--> statement-breakpoint
ALTER TABLE "onboarding_profile" ALTER COLUMN "initial_memory_score" SET DATA TYPE double precision;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ALTER COLUMN "resulting_memory_score" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_attempt_answer" ADD COLUMN "prior_mastery" double precision;--> statement-breakpoint
ALTER TABLE "quiz_attempt_answer" ADD COLUMN "posterior_mastery" double precision;--> statement-breakpoint
ALTER TABLE "quiz_attempt_answer" ADD COLUMN "mastery_after_transition" double precision;--> statement-breakpoint
ALTER TABLE "quiz_attempt_answer" ADD COLUMN "predicted_correctness" double precision;--> statement-breakpoint
ALTER TABLE "quiz_attempt_answer" ADD COLUMN "calculation_trace" jsonb;--> statement-breakpoint
ALTER TABLE "quiz_attempt_answer" ADD COLUMN "answered_at" timestamp;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD COLUMN "status" text DEFAULT 'completed' NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD COLUMN "model_version" text DEFAULT 'legacy-tier-v0' NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD COLUMN "initial_mastery" double precision;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD COLUMN "current_mastery" double precision;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD COLUMN "stability_before" double precision;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD COLUMN "stability_after" double precision;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD COLUMN "successful_reviews_before" integer;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD COLUMN "successful_reviews_after" integer;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD COLUMN "completed_at" timestamp;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD COLUMN "abandoned_at" timestamp;--> statement-breakpoint
UPDATE "quiz_attempt"
SET "status" = 'completed',
    "model_version" = 'legacy-tier-v0',
    "current_mastery" = CASE
      WHEN "resulting_memory_score" IS NULL THEN NULL
      ELSE "resulting_memory_score" / 100.0
    END,
    "completed_at" = "submitted_at";--> statement-breakpoint
UPDATE "onboarding_profile" SET "initial_memory_score" = NULL;--> statement-breakpoint
DELETE FROM "user_topic_progress";--> statement-breakpoint
ALTER TABLE "user_topic_progress" ADD COLUMN "mastery" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "user_topic_progress" ADD COLUMN "stability_days" double precision NOT NULL;--> statement-breakpoint
ALTER TABLE "user_topic_progress" ADD COLUMN "successful_reviews" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "user_topic_progress" ADD COLUMN "model_version" text DEFAULT 'bkt-v1' NOT NULL;--> statement-breakpoint
ALTER TABLE "quiz_attempt_question" ADD CONSTRAINT "quiz_attempt_question_attempt_id_quiz_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_attempt_question_key_idx" ON "quiz_attempt_question" USING btree ("attempt_id","question_key");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_attempt_answer_index_idx" ON "quiz_attempt_answer" USING btree ("attempt_id","question_index");--> statement-breakpoint
CREATE UNIQUE INDEX "quiz_attempt_one_active_speed_topic_idx" ON "quiz_attempt" USING btree ("user_id","topic_id") WHERE "quiz_attempt"."quiz_mode" = 'speed-round' and "quiz_attempt"."status" = 'in_progress';--> statement-breakpoint
ALTER TABLE "user_topic_progress" DROP COLUMN "memory_score";--> statement-breakpoint
ALTER TABLE "user_topic_progress" DROP COLUMN "next_review_at";--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD CONSTRAINT "quiz_attempt_status_check" CHECK ("quiz_attempt"."status" in ('in_progress', 'completed', 'abandoned'));--> statement-breakpoint
ALTER TABLE "user_topic_progress" ADD CONSTRAINT "user_topic_progress_mastery_check" CHECK ("user_topic_progress"."mastery" >= 0 and "user_topic_progress"."mastery" <= 1);--> statement-breakpoint
ALTER TABLE "user_topic_progress" ADD CONSTRAINT "user_topic_progress_stability_check" CHECK ("user_topic_progress"."stability_days" > 0);--> statement-breakpoint
ALTER TABLE "user_topic_progress" ADD CONSTRAINT "user_topic_progress_successful_reviews_check" CHECK ("user_topic_progress"."successful_reviews" >= 0);
