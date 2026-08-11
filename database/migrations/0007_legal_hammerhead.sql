CREATE TABLE "question_review" (
	"question_key" text PRIMARY KEY NOT NULL,
	"edited_explanation" text NOT NULL,
	"reviewed_by_user_id" text NOT NULL,
	"reviewed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "question_review" ADD CONSTRAINT "question_review_reviewed_by_user_id_user_id_fk" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;