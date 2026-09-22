CREATE TABLE "edunets"."squad_quiz_room_answers" (
	"room_id" text NOT NULL,
	"user_id" text NOT NULL,
	"question_index" integer NOT NULL,
	"submitted_answer" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"points" integer NOT NULL,
	"answered_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "squad_quiz_room_answers_room_id_user_id_question_index_pk" PRIMARY KEY("room_id","user_id","question_index"),
	CONSTRAINT "squad_quiz_answers_points_check" CHECK ("edunets"."squad_quiz_room_answers"."points" in (0, 10))
);
--> statement-breakpoint
CREATE TABLE "edunets"."squad_quiz_room_completions" (
	"room_id" text NOT NULL,
	"run_number" integer NOT NULL,
	"completed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "squad_quiz_room_completions_room_id_run_number_pk" PRIMARY KEY("room_id","run_number"),
	CONSTRAINT "squad_quiz_completions_run_check" CHECK ("edunets"."squad_quiz_room_completions"."run_number" >= 0)
);
--> statement-breakpoint
CREATE TABLE "edunets"."squad_quiz_room_participants" (
	"room_id" text NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_color" text DEFAULT 'Yellow' NOT NULL,
	"status" text DEFAULT 'invited' NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"last_answer_correct" boolean,
	"joined_at" timestamp,
	"last_seen_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "squad_quiz_room_participants_room_id_user_id_pk" PRIMARY KEY("room_id","user_id"),
	CONSTRAINT "squad_quiz_participants_status_check" CHECK ("edunets"."squad_quiz_room_participants"."status" in ('invited', 'joined', 'answered', 'finished', 'left')),
	CONSTRAINT "squad_quiz_participants_avatar_check" CHECK ("edunets"."squad_quiz_room_participants"."avatar_color" in ('Yellow', 'LightBlue', 'White')),
	CONSTRAINT "squad_quiz_participants_score_check" CHECK ("edunets"."squad_quiz_room_participants"."score" >= 0)
);
--> statement-breakpoint
CREATE TABLE "edunets"."squad_quiz_room_questions" (
	"room_id" text NOT NULL,
	"question_index" integer NOT NULL,
	"question_key" text NOT NULL,
	CONSTRAINT "squad_quiz_room_questions_room_id_question_index_pk" PRIMARY KEY("room_id","question_index"),
	CONSTRAINT "squad_quiz_room_questions_index_check" CHECK ("edunets"."squad_quiz_room_questions"."question_index" between 0 and 9)
);
--> statement-breakpoint
CREATE TABLE "edunets"."squad_quiz_rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"squad_id" text NOT NULL,
	"host_user_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"current_question_index" integer DEFAULT 0 NOT NULL,
	"total_rounds" integer NOT NULL,
	"question_started_at" timestamp NOT NULL,
	"restart_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	CONSTRAINT "squad_quiz_rooms_status_check" CHECK ("edunets"."squad_quiz_rooms"."status" in ('active', 'finished')),
	CONSTRAINT "squad_quiz_rooms_rounds_check" CHECK ("edunets"."squad_quiz_rooms"."total_rounds" between 1 and 10),
	CONSTRAINT "squad_quiz_rooms_question_index_check" CHECK ("edunets"."squad_quiz_rooms"."current_question_index" >= 0 and "edunets"."squad_quiz_rooms"."current_question_index" < "edunets"."squad_quiz_rooms"."total_rounds")
);
--> statement-breakpoint
ALTER TABLE "edunets"."notifications" DROP CONSTRAINT "notifications_type_check";--> statement-breakpoint
ALTER TABLE "edunets"."squad_quiz_room_answers" ADD CONSTRAINT "squad_quiz_room_answers_room_id_squad_quiz_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "edunets"."squad_quiz_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."squad_quiz_room_answers" ADD CONSTRAINT "squad_quiz_room_answers_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."squad_quiz_room_completions" ADD CONSTRAINT "squad_quiz_room_completions_room_id_squad_quiz_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "edunets"."squad_quiz_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."squad_quiz_room_participants" ADD CONSTRAINT "squad_quiz_room_participants_room_id_squad_quiz_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "edunets"."squad_quiz_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."squad_quiz_room_participants" ADD CONSTRAINT "squad_quiz_room_participants_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."squad_quiz_room_questions" ADD CONSTRAINT "squad_quiz_room_questions_room_id_squad_quiz_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "edunets"."squad_quiz_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."squad_quiz_rooms" ADD CONSTRAINT "squad_quiz_rooms_squad_id_study_squads_id_fk" FOREIGN KEY ("squad_id") REFERENCES "edunets"."study_squads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."squad_quiz_rooms" ADD CONSTRAINT "squad_quiz_rooms_host_user_id_user_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."squad_quiz_rooms" ADD CONSTRAINT "squad_quiz_rooms_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "squad_quiz_answers_room_question_idx" ON "edunets"."squad_quiz_room_answers" USING btree ("room_id","question_index");--> statement-breakpoint
CREATE INDEX "squad_quiz_completions_created_idx" ON "edunets"."squad_quiz_room_completions" USING btree ("completed_at");--> statement-breakpoint
CREATE INDEX "squad_quiz_participants_room_status_idx" ON "edunets"."squad_quiz_room_participants" USING btree ("room_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "squad_quiz_room_questions_key_uidx" ON "edunets"."squad_quiz_room_questions" USING btree ("room_id","question_key");--> statement-breakpoint
CREATE INDEX "squad_quiz_rooms_squad_created_idx" ON "edunets"."squad_quiz_rooms" USING btree ("squad_id","created_at");--> statement-breakpoint
CREATE INDEX "squad_quiz_rooms_status_idx" ON "edunets"."squad_quiz_rooms" USING btree ("status","updated_at");--> statement-breakpoint
ALTER TABLE "edunets"."notifications" ADD CONSTRAINT "notifications_type_check" CHECK ("edunets"."notifications"."type" in ('teacher_enquiry', 'teacher_reply', 'squad_invitation', 'squad_invitation_accepted', 'squad_invitation_declined', 'squad_streak_restored', 'squad_quiz_invitation', 'squad_quiz_finished'));