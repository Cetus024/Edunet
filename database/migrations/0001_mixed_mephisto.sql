ALTER TABLE "schools" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "icon" text;--> statement-breakpoint
ALTER TABLE "subjects" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "topics" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;