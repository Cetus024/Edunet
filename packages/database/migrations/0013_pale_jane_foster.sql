CREATE TABLE "edunets"."notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"recipient_user_id" text NOT NULL,
	"actor_user_id" text,
	"channel" text NOT NULL,
	"type" text NOT NULL,
	"title" varchar(160) NOT NULL,
	"body" text NOT NULL,
	"href" varchar(500) NOT NULL,
	"resource_id" text,
	"dedupe_key" varchar(200) NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_channel_check" CHECK ("edunets"."notifications"."channel" in ('teacher', 'study_squad')),
	CONSTRAINT "notifications_type_check" CHECK ("edunets"."notifications"."type" in ('teacher_enquiry', 'teacher_reply', 'squad_invitation', 'squad_invitation_accepted', 'squad_invitation_declined')),
	CONSTRAINT "notifications_href_check" CHECK ("edunets"."notifications"."href" like '/%')
);
--> statement-breakpoint
ALTER TABLE "edunets"."study_squad_invitations" DROP CONSTRAINT "study_squad_invitations_delivery_status_check";--> statement-breakpoint
ALTER TABLE "edunets"."study_squad_invitations" ALTER COLUMN "token_hash" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "edunets"."study_squad_invitations" ADD COLUMN "invited_user_id" text;--> statement-breakpoint
ALTER TABLE "edunets"."notifications" ADD CONSTRAINT "notifications_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."notifications" ADD CONSTRAINT "notifications_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notifications_dedupe_key_uidx" ON "edunets"."notifications" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "notifications_recipient_created_idx" ON "edunets"."notifications" USING btree ("recipient_user_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_recipient_unread_idx" ON "edunets"."notifications" USING btree ("recipient_user_id","created_at") WHERE "edunets"."notifications"."read_at" is null;--> statement-breakpoint
ALTER TABLE "edunets"."study_squad_invitations" ADD CONSTRAINT "study_squad_invitations_invited_user_id_user_id_fk" FOREIGN KEY ("invited_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "study_squad_invitations_pending_user_uidx" ON "edunets"."study_squad_invitations" USING btree ("squad_id","invited_user_id") WHERE "edunets"."study_squad_invitations"."status" = 'pending' and "edunets"."study_squad_invitations"."invited_user_id" is not null;--> statement-breakpoint
ALTER TABLE "edunets"."study_squad_invitations" ADD CONSTRAINT "study_squad_invitations_delivery_status_check" CHECK ("edunets"."study_squad_invitations"."delivery_status" in ('pending', 'sent', 'failed', 'in_app'));