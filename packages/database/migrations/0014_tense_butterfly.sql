CREATE TABLE "edunets"."study_squad_streak_restores" (
	"id" text PRIMARY KEY NOT NULL,
	"squad_id" text NOT NULL,
	"restored_date" date NOT NULL,
	"restored_by_user_id" text NOT NULL,
	"restored_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "edunets"."notifications" DROP CONSTRAINT "notifications_type_check";--> statement-breakpoint
ALTER TABLE "edunets"."study_squad_streak_restores" ADD CONSTRAINT "study_squad_streak_restores_squad_id_study_squads_id_fk" FOREIGN KEY ("squad_id") REFERENCES "edunets"."study_squads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."study_squad_streak_restores" ADD CONSTRAINT "study_squad_streak_restores_restored_by_user_id_user_id_fk" FOREIGN KEY ("restored_by_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "study_squad_streak_restores_squad_date_uidx" ON "edunets"."study_squad_streak_restores" USING btree ("squad_id","restored_date");--> statement-breakpoint
CREATE INDEX "study_squad_streak_restores_squad_created_idx" ON "edunets"."study_squad_streak_restores" USING btree ("squad_id","restored_at");--> statement-breakpoint
ALTER TABLE "edunets"."notifications" ADD CONSTRAINT "notifications_type_check" CHECK ("edunets"."notifications"."type" in ('teacher_enquiry', 'teacher_reply', 'squad_invitation', 'squad_invitation_accepted', 'squad_invitation_declined', 'squad_streak_restored'));