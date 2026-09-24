CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;
--> statement-breakpoint
CREATE TABLE "edunets"."reference_chunks" (
	"id" text PRIMARY KEY NOT NULL,
	"document_id" text NOT NULL,
	"topic_id" text NOT NULL,
	"page" integer,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	CONSTRAINT "reference_chunks_chunk_index_check" CHECK ("edunets"."reference_chunks"."chunk_index" >= 0),
	CONSTRAINT "reference_chunks_page_check" CHECK ("edunets"."reference_chunks"."page" is null or "edunets"."reference_chunks"."page" >= 1),
	CONSTRAINT "reference_chunks_content_check" CHECK (char_length(btrim("edunets"."reference_chunks"."content")) > 0)
);
--> statement-breakpoint
CREATE TABLE "edunets"."reference_document_topics" (
	"document_id" text NOT NULL,
	"topic_id" text NOT NULL,
	CONSTRAINT "reference_document_topics_document_id_topic_id_pk" PRIMARY KEY("document_id","topic_id")
);
--> statement-breakpoint
CREATE TABLE "edunets"."reference_documents" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"source_filename" text NOT NULL,
	"subject_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "edunets"."reference_chunks" ADD CONSTRAINT "reference_chunks_document_id_reference_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "edunets"."reference_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."reference_chunks" ADD CONSTRAINT "reference_chunks_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."reference_document_topics" ADD CONSTRAINT "reference_document_topics_document_id_reference_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "edunets"."reference_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."reference_document_topics" ADD CONSTRAINT "reference_document_topics_topic_id_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."topics"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "edunets"."reference_documents" ADD CONSTRAINT "reference_documents_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "reference_chunks_document_topic_chunk_uidx" ON "edunets"."reference_chunks" USING btree ("document_id","topic_id","chunk_index");--> statement-breakpoint
CREATE INDEX "reference_chunks_topic_idx" ON "edunets"."reference_chunks" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "reference_chunks_embedding_idx" ON "edunets"."reference_chunks" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "reference_document_topics_topic_idx" ON "edunets"."reference_document_topics" USING btree ("topic_id");--> statement-breakpoint
CREATE UNIQUE INDEX "reference_documents_source_filename_uidx" ON "edunets"."reference_documents" USING btree ("source_filename");--> statement-breakpoint
CREATE INDEX "reference_documents_subject_idx" ON "edunets"."reference_documents" USING btree ("subject_id");
