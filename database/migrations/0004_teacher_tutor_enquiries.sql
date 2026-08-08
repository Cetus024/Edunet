CREATE TABLE "edunets"."enquiry_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"thread_id" text NOT NULL,
	"sender_user_id" text,
	"sender_role" text NOT NULL,
	"sender_display_name" text NOT NULL,
	"sender_email_snapshot" text,
	"body" text NOT NULL,
	"submission_id" text NOT NULL,
	"unread" boolean DEFAULT true NOT NULL,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "enquiry_messages_unread_read_at_check" CHECK (("edunets"."enquiry_messages"."unread" = true AND "edunets"."enquiry_messages"."read_at" IS NULL) OR ("edunets"."enquiry_messages"."unread" = false AND "edunets"."enquiry_messages"."read_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "edunets"."enquiry_threads" (
	"id" text PRIMARY KEY NOT NULL,
	"requester_user_id" text,
	"recipient_user_id" text NOT NULL,
	"requester_role" text NOT NULL,
	"recipient_role" text NOT NULL,
	"requester_display_name" text NOT NULL,
	"requester_class_snapshot" varchar(80),
	"requester_email_snapshot" text,
	"recipient_display_name" text NOT NULL,
	"recipient_email_snapshot" text,
	"subject_id" text NOT NULL,
	"subject_name_snapshot" text NOT NULL,
	"topic_id" text,
	"topic_name_snapshot" text,
	"title" text NOT NULL,
	"is_demo" boolean DEFAULT false NOT NULL,
	"demo_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "enquiry_threads_demo_requester_check" CHECK ("edunets"."enquiry_threads"."is_demo" = true OR "edunets"."enquiry_threads"."requester_user_id" IS NOT NULL),
	CONSTRAINT "enquiry_threads_topic_snapshot_check" CHECK (("edunets"."enquiry_threads"."topic_id" IS NULL AND "edunets"."enquiry_threads"."topic_name_snapshot" IS NULL) OR ("edunets"."enquiry_threads"."topic_id" IS NOT NULL AND "edunets"."enquiry_threads"."topic_name_snapshot" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "edunets"."enquiry_messages" ADD CONSTRAINT "enquiry_messages_thread_id_enquiry_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "edunets"."enquiry_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."enquiry_messages" ADD CONSTRAINT "enquiry_messages_sender_user_id_user_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."enquiry_threads" ADD CONSTRAINT "enquiry_threads_requester_user_id_user_id_fk" FOREIGN KEY ("requester_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."enquiry_threads" ADD CONSTRAINT "enquiry_threads_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."enquiry_threads" ADD CONSTRAINT "enquiry_threads_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."enquiry_threads" ADD CONSTRAINT "enquiry_threads_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "enquiry_messages_submission_id_uidx" ON "edunets"."enquiry_messages" USING btree ("submission_id");--> statement-breakpoint
CREATE INDEX "enquiry_messages_thread_created_idx" ON "edunets"."enquiry_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "enquiry_messages_thread_unread_idx" ON "edunets"."enquiry_messages" USING btree ("thread_id","unread");--> statement-breakpoint
CREATE UNIQUE INDEX "enquiry_threads_recipient_demo_key_uidx" ON "edunets"."enquiry_threads" USING btree ("recipient_user_id","demo_key");--> statement-breakpoint
CREATE INDEX "enquiry_threads_recipient_updated_idx" ON "edunets"."enquiry_threads" USING btree ("recipient_user_id","updated_at");--> statement-breakpoint
CREATE INDEX "enquiry_threads_requester_updated_idx" ON "edunets"."enquiry_threads" USING btree ("requester_user_id","updated_at");--> statement-breakpoint
CREATE INDEX "enquiry_threads_subject_topic_idx" ON "edunets"."enquiry_threads" USING btree ("subject_id","topic_id");