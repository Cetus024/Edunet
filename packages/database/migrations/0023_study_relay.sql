CREATE TABLE "edunets"."study_relay_rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"code" varchar(8) NOT NULL,
	"host_player_id" text NOT NULL,
	"subject" text DEFAULT 'chemistry' NOT NULL,
	"status" text DEFAULT 'lobby' NOT NULL,
	"current_hop" integer DEFAULT 0 NOT NULL,
	"min_players" integer DEFAULT 3 NOT NULL,
	"max_players" integer DEFAULT 10 NOT NULL,
	"squad_id" text,
	"phase_started_at" timestamp,
	"phase_ends_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "study_relay_rooms_status_check" CHECK ("edunets"."study_relay_rooms"."status" in ('lobby', 'drawing', 'explaining', 'reveal', 'ended')),
	CONSTRAINT "study_relay_rooms_subject_check" CHECK ("edunets"."study_relay_rooms"."subject" in ('chemistry', 'mathematics')),
	CONSTRAINT "study_relay_rooms_hop_check" CHECK ("edunets"."study_relay_rooms"."current_hop" >= 0),
	CONSTRAINT "study_relay_rooms_min_players_check" CHECK ("edunets"."study_relay_rooms"."min_players" >= 3),
	CONSTRAINT "study_relay_rooms_max_players_check" CHECK ("edunets"."study_relay_rooms"."max_players" between 3 and 10),
	CONSTRAINT "study_relay_rooms_player_bounds_check" CHECK ("edunets"."study_relay_rooms"."min_players" <= "edunets"."study_relay_rooms"."max_players")
);
--> statement-breakpoint
CREATE TABLE "edunets"."study_relay_players" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"display_name" varchar(40) NOT NULL,
	"user_id" text,
	"join_token_hash" varchar(64) NOT NULL,
	"seat_index" integer NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"is_connected" boolean DEFAULT true NOT NULL,
	CONSTRAINT "study_relay_players_seat_check" CHECK ("edunets"."study_relay_players"."seat_index" >= 0 and "edunets"."study_relay_players"."seat_index" < 10),
	CONSTRAINT "study_relay_players_name_check" CHECK (char_length(btrim("edunets"."study_relay_players"."display_name")) between 1 and 40)
);
--> statement-breakpoint
CREATE TABLE "edunets"."study_relay_room_prompts" (
	"room_id" text NOT NULL,
	"chain_id" text NOT NULL,
	"prompt_id" text NOT NULL,
	"drawer_player_id" text NOT NULL,
	"seat_index" integer NOT NULL,
	CONSTRAINT "study_relay_room_prompts_room_id_chain_id_pk" PRIMARY KEY("room_id","chain_id"),
	CONSTRAINT "study_relay_room_prompts_seat_check" CHECK ("edunets"."study_relay_room_prompts"."seat_index" >= 0 and "edunets"."study_relay_room_prompts"."seat_index" < 10)
);
--> statement-breakpoint
CREATE TABLE "edunets"."study_relay_submissions" (
	"id" text PRIMARY KEY NOT NULL,
	"room_id" text NOT NULL,
	"chain_id" text NOT NULL,
	"player_id" text NOT NULL,
	"type" text NOT NULL,
	"image_url" text,
	"text" text,
	"hop_index" integer NOT NULL,
	"skipped" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "study_relay_submissions_type_check" CHECK ("edunets"."study_relay_submissions"."type" in ('drawing', 'explanation')),
	CONSTRAINT "study_relay_submissions_hop_check" CHECK ("edunets"."study_relay_submissions"."hop_index" >= 0),
	CONSTRAINT "study_relay_submissions_payload_check" CHECK (("edunets"."study_relay_submissions"."skipped" = true) or ("edunets"."study_relay_submissions"."type" = 'drawing' and "edunets"."study_relay_submissions"."image_url" is not null) or ("edunets"."study_relay_submissions"."type" = 'explanation' and "edunets"."study_relay_submissions"."text" is not null))
);
--> statement-breakpoint
ALTER TABLE "edunets"."study_relay_rooms" ADD CONSTRAINT "study_relay_rooms_squad_id_study_squads_id_fk" FOREIGN KEY ("squad_id") REFERENCES "edunets"."study_squads"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."study_relay_players" ADD CONSTRAINT "study_relay_players_room_id_study_relay_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "edunets"."study_relay_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."study_relay_players" ADD CONSTRAINT "study_relay_players_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."study_relay_room_prompts" ADD CONSTRAINT "study_relay_room_prompts_room_id_study_relay_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "edunets"."study_relay_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."study_relay_room_prompts" ADD CONSTRAINT "study_relay_room_prompts_drawer_player_id_study_relay_players_id_fk" FOREIGN KEY ("drawer_player_id") REFERENCES "edunets"."study_relay_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."study_relay_submissions" ADD CONSTRAINT "study_relay_submissions_room_id_study_relay_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "edunets"."study_relay_rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."study_relay_submissions" ADD CONSTRAINT "study_relay_submissions_player_id_study_relay_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "edunets"."study_relay_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "study_relay_rooms_code_uidx" ON "edunets"."study_relay_rooms" USING btree ("code");--> statement-breakpoint
CREATE INDEX "study_relay_rooms_status_idx" ON "edunets"."study_relay_rooms" USING btree ("status","updated_at");--> statement-breakpoint
CREATE INDEX "study_relay_rooms_squad_idx" ON "edunets"."study_relay_rooms" USING btree ("squad_id");--> statement-breakpoint
CREATE UNIQUE INDEX "study_relay_players_room_seat_uidx" ON "edunets"."study_relay_players" USING btree ("room_id","seat_index");--> statement-breakpoint
CREATE UNIQUE INDEX "study_relay_players_token_uidx" ON "edunets"."study_relay_players" USING btree ("join_token_hash");--> statement-breakpoint
CREATE INDEX "study_relay_players_room_idx" ON "edunets"."study_relay_players" USING btree ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "study_relay_room_prompts_drawer_uidx" ON "edunets"."study_relay_room_prompts" USING btree ("room_id","drawer_player_id");--> statement-breakpoint
CREATE UNIQUE INDEX "study_relay_room_prompts_prompt_uidx" ON "edunets"."study_relay_room_prompts" USING btree ("room_id","prompt_id");--> statement-breakpoint
CREATE UNIQUE INDEX "study_relay_submissions_hop_uidx" ON "edunets"."study_relay_submissions" USING btree ("room_id","chain_id","hop_index");--> statement-breakpoint
CREATE INDEX "study_relay_submissions_room_hop_idx" ON "edunets"."study_relay_submissions" USING btree ("room_id","hop_index");--> statement-breakpoint
CREATE INDEX "study_relay_submissions_player_idx" ON "edunets"."study_relay_submissions" USING btree ("room_id","player_id");
