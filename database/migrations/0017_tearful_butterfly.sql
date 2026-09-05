CREATE TABLE "edunets"."learning_work" (
	"id" text PRIMARY KEY NOT NULL,
	"room_kind" text NOT NULL,
	"room_id" text NOT NULL,
	"user_id" text NOT NULL,
	"question_index" integer DEFAULT 0 NOT NULL,
	"run_number" integer DEFAULT 0 NOT NULL,
	"question" text NOT NULL,
	"transcript" text NOT NULL,
	"strokes" jsonb NOT NULL,
	"analysis" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "learning_work_kind_check" CHECK ("edunets"."learning_work"."room_kind" in ('rescue', 'revision'))
);
--> statement-breakpoint
ALTER TABLE "edunets"."learning_work" ADD CONSTRAINT "learning_work_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "learning_work_room_idx" ON "edunets"."learning_work" USING btree ("room_kind","room_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "learning_work_rescue_round_uidx" ON "edunets"."learning_work" USING btree ("room_id","user_id","run_number","question_index") WHERE "edunets"."learning_work"."room_kind" = 'rescue';