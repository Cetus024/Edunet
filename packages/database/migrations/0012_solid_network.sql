CREATE TABLE "discussion_participant" (
	"room_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"left_at" timestamp,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"speaking_ms" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "discussion_participant_room_id_user_id_pk" PRIMARY KEY("room_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "discussion_review" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"user_id" text,
	"coverage" jsonb NOT NULL,
	"summary" text,
	"generated_by" text DEFAULT 'rubric' NOT NULL,
	"generated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discussion_review_generated_by_check" CHECK ("discussion_review"."generated_by" in ('rubric', 'modelarts'))
);
--> statement-breakpoint
CREATE TABLE "discussion_room" (
	"id" text PRIMARY KEY NOT NULL,
	"subject_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"host_user_id" text NOT NULL,
	"status" text DEFAULT 'lobby' NOT NULL,
	"duration_seconds" integer DEFAULT 180 NOT NULL,
	"join_code" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"ended_at" timestamp,
	CONSTRAINT "discussion_room_join_code_unique" UNIQUE("join_code"),
	CONSTRAINT "discussion_room_status_check" CHECK ("discussion_room"."status" in ('lobby', 'live', 'reviewing', 'ended')),
	CONSTRAINT "discussion_room_duration_check" CHECK ("discussion_room"."duration_seconds" between 30 and 1800)
);
--> statement-breakpoint
CREATE TABLE "discussion_signal" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"from_user_id" text NOT NULL,
	"to_user_id" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"consumed_at" timestamp,
	CONSTRAINT "discussion_signal_kind_check" CHECK ("discussion_signal"."kind" in ('offer', 'answer', 'candidate'))
);
--> statement-breakpoint
CREATE TABLE "discussion_utterance" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"user_id" text NOT NULL,
	"text" text NOT NULL,
	"locale" text DEFAULT 'en' NOT NULL,
	"provider" text DEFAULT 'browser' NOT NULL,
	"spoken_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discussion_utterance_provider_check" CHECK ("discussion_utterance"."provider" in ('browser', 'huawei'))
);
--> statement-breakpoint
CREATE TABLE "edunets"."study_squad_invitations" (
	"id" text PRIMARY KEY NOT NULL,
	"squad_id" text NOT NULL,
	"invited_email" text NOT NULL,
	"invited_by_user_id" text,
	"token_hash" varchar(64) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"delivery_status" text DEFAULT 'pending' NOT NULL,
	"email_message_id" text,
	"expires_at" timestamp NOT NULL,
	"accepted_by_user_id" text,
	"accepted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "study_squad_invitations_status_check" CHECK ("edunets"."study_squad_invitations"."status" in ('pending', 'accepted', 'revoked', 'expired')),
	CONSTRAINT "study_squad_invitations_delivery_status_check" CHECK ("edunets"."study_squad_invitations"."delivery_status" in ('pending', 'sent', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "edunets"."study_squad_members" (
	"squad_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text DEFAULT 'member' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "study_squad_members_squad_id_user_id_pk" PRIMARY KEY("squad_id","user_id"),
	CONSTRAINT "study_squad_members_role_check" CHECK ("edunets"."study_squad_members"."role" in ('owner', 'member'))
);
--> statement-breakpoint
CREATE TABLE "edunets"."study_squads" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(80) NOT NULL,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "study_squads_name_check" CHECK (char_length(btrim("edunets"."study_squads"."name")) between 1 and 80)
);
--> statement-breakpoint
ALTER TABLE "discussion_participant" ADD CONSTRAINT "discussion_participant_room_id_discussion_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."discussion_room"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_participant" ADD CONSTRAINT "discussion_participant_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_review" ADD CONSTRAINT "discussion_review_room_id_discussion_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."discussion_room"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_review" ADD CONSTRAINT "discussion_review_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_room" ADD CONSTRAINT "discussion_room_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_room" ADD CONSTRAINT "discussion_room_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_room" ADD CONSTRAINT "discussion_room_host_user_id_user_id_fk" FOREIGN KEY ("host_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_signal" ADD CONSTRAINT "discussion_signal_room_id_discussion_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."discussion_room"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_signal" ADD CONSTRAINT "discussion_signal_from_user_id_user_id_fk" FOREIGN KEY ("from_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_signal" ADD CONSTRAINT "discussion_signal_to_user_id_user_id_fk" FOREIGN KEY ("to_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_utterance" ADD CONSTRAINT "discussion_utterance_room_id_discussion_room_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."discussion_room"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "discussion_utterance" ADD CONSTRAINT "discussion_utterance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."study_squad_invitations" ADD CONSTRAINT "study_squad_invitations_squad_id_study_squads_id_fk" FOREIGN KEY ("squad_id") REFERENCES "edunets"."study_squads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."study_squad_invitations" ADD CONSTRAINT "study_squad_invitations_invited_by_user_id_user_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."study_squad_invitations" ADD CONSTRAINT "study_squad_invitations_accepted_by_user_id_user_id_fk" FOREIGN KEY ("accepted_by_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."study_squad_members" ADD CONSTRAINT "study_squad_members_squad_id_study_squads_id_fk" FOREIGN KEY ("squad_id") REFERENCES "edunets"."study_squads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."study_squad_members" ADD CONSTRAINT "study_squad_members_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."study_squads" ADD CONSTRAINT "study_squads_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "discussion_participant_room_idx" ON "discussion_participant" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "discussion_review_room_idx" ON "discussion_review" USING btree ("room_id");--> statement-breakpoint
CREATE INDEX "discussion_room_topic_idx" ON "discussion_room" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "discussion_signal_inbox_idx" ON "discussion_signal" USING btree ("room_id","to_user_id","created_at");--> statement-breakpoint
CREATE INDEX "discussion_utterance_room_user_idx" ON "discussion_utterance" USING btree ("room_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "study_squad_invitations_token_uidx" ON "edunets"."study_squad_invitations" USING btree ("token_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "study_squad_invitations_pending_email_uidx" ON "edunets"."study_squad_invitations" USING btree ("squad_id","invited_email") WHERE "edunets"."study_squad_invitations"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "study_squad_invitations_squad_status_idx" ON "edunets"."study_squad_invitations" USING btree ("squad_id","status");--> statement-breakpoint
CREATE INDEX "study_squad_invitations_expiry_idx" ON "edunets"."study_squad_invitations" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "study_squad_members_user_uidx" ON "edunets"."study_squad_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "study_squad_members_squad_joined_idx" ON "edunets"."study_squad_members" USING btree ("squad_id","joined_at");--> statement-breakpoint
CREATE INDEX "study_squads_owner_idx" ON "edunets"."study_squads" USING btree ("owner_user_id");