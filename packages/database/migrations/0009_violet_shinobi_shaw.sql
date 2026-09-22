DELETE FROM "edunets"."enquiry_threads"
WHERE "requester_role" IN ('parent', 'tutor')
  OR "recipient_role" IN ('parent', 'tutor')
  OR "requester_user_id" IN (
    SELECT "user_id" FROM "profile" WHERE "role" IN ('parent', 'tutor')
  )
  OR "recipient_user_id" IN (
    SELECT "user_id" FROM "profile" WHERE "role" IN ('parent', 'tutor')
  )
  OR "id" IN (
    SELECT "thread_id"
    FROM "edunets"."enquiry_messages"
    WHERE "sender_role" IN ('parent', 'tutor')
      OR "sender_user_id" IN (
        SELECT "user_id" FROM "profile" WHERE "role" IN ('parent', 'tutor')
      )
  );--> statement-breakpoint
DELETE FROM "question_review"
WHERE "reviewed_by_user_id" IN (
  SELECT "user_id" FROM "profile" WHERE "role" IN ('parent', 'tutor')
);--> statement-breakpoint
DELETE FROM "user"
WHERE "id" IN (
  SELECT "user_id" FROM "profile" WHERE "role" IN ('parent', 'tutor')
);--> statement-breakpoint
DELETE FROM "user_topic_progress"
WHERE "user_id" IN (
  SELECT "user_id" FROM "profile" WHERE "role" = 'teacher'
);--> statement-breakpoint
ALTER TABLE "onboarding_profile" ALTER COLUMN "topic_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "onboarding_profile" ALTER COLUMN "initial_memory_score" DROP NOT NULL;--> statement-breakpoint
UPDATE "onboarding_profile"
SET "topic_id" = NULL,
    "initial_memory_score" = NULL
WHERE "user_id" IN (
  SELECT "user_id" FROM "profile" WHERE "role" = 'teacher'
);--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD COLUMN "usage" text DEFAULT 'practice' NOT NULL;--> statement-breakpoint
UPDATE "quiz_questions"
SET "usage" = CASE WHEN "type" = 'mcq' THEN 'both' ELSE 'practice' END;--> statement-breakpoint
ALTER TABLE "onboarding_profile" ADD COLUMN "placement_attempt_id" text;--> statement-breakpoint
ALTER TABLE "onboarding_profile" ADD CONSTRAINT "onboarding_profile_placement_attempt_id_quiz_attempt_id_fk" FOREIGN KEY ("placement_attempt_id") REFERENCES "public"."quiz_attempt"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "onboarding_profile" DROP COLUMN "familiarity";--> statement-breakpoint
ALTER TABLE "onboarding_profile" DROP COLUMN "child_name";--> statement-breakpoint
ALTER TABLE "onboarding_profile" DROP COLUMN "child_email";--> statement-breakpoint
ALTER TABLE "onboarding_profile" ADD CONSTRAINT "onboarding_profile_placement_attempt_id_unique" UNIQUE("placement_attempt_id");--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_usage_check" CHECK ("quiz_questions"."usage" in ('practice', 'placement', 'both'));--> statement-breakpoint
ALTER TABLE "profile" ADD CONSTRAINT "profile_role_check" CHECK ("profile"."role" in ('student', 'teacher'));--> statement-breakpoint
ALTER TABLE "edunets"."enquiry_messages" ADD CONSTRAINT "enquiry_messages_sender_role_check" CHECK ("edunets"."enquiry_messages"."sender_role" in ('student', 'teacher'));--> statement-breakpoint
ALTER TABLE "edunets"."enquiry_threads" ADD CONSTRAINT "enquiry_threads_requester_role_check" CHECK ("edunets"."enquiry_threads"."requester_role" = 'student');--> statement-breakpoint
ALTER TABLE "edunets"."enquiry_threads" ADD CONSTRAINT "enquiry_threads_recipient_role_check" CHECK ("edunets"."enquiry_threads"."recipient_role" = 'teacher');
