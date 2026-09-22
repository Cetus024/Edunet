import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from 'drizzle-orm/pg-core';

import { EDUNETS_SCHEMA_NAME } from '../constants.js';
import { subjects, topics } from './catalog.js';

export const REFERENCE_EMBEDDING_DIMENSIONS = 1536 as const;

const edunetsSchema = pgSchema(EDUNETS_SCHEMA_NAME);

export const referenceDocuments = edunetsSchema.table('reference_documents', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  sourceFilename: text('source_filename').notNull(),
  subjectId: text('subject_id').notNull().references(() => subjects.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('reference_documents_source_filename_uidx').on(table.sourceFilename),
  index('reference_documents_subject_idx').on(table.subjectId),
]);

export const referenceDocumentTopics = edunetsSchema.table('reference_document_topics', {
  documentId: text('document_id').notNull().references(() => referenceDocuments.id, { onDelete: 'cascade' }),
  topicId: text('topic_id').notNull().references(() => topics.id),
}, (table) => [
  primaryKey({ columns: [table.documentId, table.topicId] }),
  index('reference_document_topics_topic_idx').on(table.topicId),
]);

export const referenceChunks = edunetsSchema.table('reference_chunks', {
  id: text('id').primaryKey(),
  documentId: text('document_id').notNull().references(() => referenceDocuments.id, { onDelete: 'cascade' }),
  topicId: text('topic_id').notNull().references(() => topics.id),
  page: integer('page'),
  chunkIndex: integer('chunk_index').notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: REFERENCE_EMBEDDING_DIMENSIONS }).notNull(),
}, (table) => [
  uniqueIndex('reference_chunks_document_topic_chunk_uidx').on(table.documentId, table.topicId, table.chunkIndex),
  index('reference_chunks_topic_idx').on(table.topicId),
  index('reference_chunks_embedding_idx').using('hnsw', table.embedding.op('vector_cosine_ops')),
  check('reference_chunks_chunk_index_check', sql`${table.chunkIndex} >= 0`),
  check('reference_chunks_page_check', sql`${table.page} is null or ${table.page} >= 1`),
  check('reference_chunks_content_check', sql`char_length(btrim(${table.content})) > 0`),
]);
