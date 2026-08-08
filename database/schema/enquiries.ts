import { sql } from 'drizzle-orm';
import { boolean, check, index, pgSchema, text, timestamp, uniqueIndex, varchar } from 'drizzle-orm/pg-core';

import { EDUNETS_SCHEMA_NAME } from '../constants.js';
import { users } from './auth.js';
import { subjects, topics } from './catalog.js';

const edunetsSchema = pgSchema(EDUNETS_SCHEMA_NAME);

const REQUESTER_ROLES = ['student', 'parent'] as const;
const RECIPIENT_ROLES = ['teacher', 'tutor'] as const;
const SENDER_ROLES = ['student', 'parent', 'teacher', 'tutor'] as const;

export const enquiryRequesterRoleEnum = {
  enumValues: REQUESTER_ROLES,
};

export const enquiryRecipientRoleEnum = {
  enumValues: RECIPIENT_ROLES,
};

export const enquirySenderRoleEnum = {
  enumValues: SENDER_ROLES,
};

// Real requester/recipient/sender identities live in the "edunets" schema
// alongside the rest of this feature's tables, kept separate from the
// public-schema auth/catalog tables they reference.
export const enquiryThreads = edunetsSchema.table('enquiry_threads', {
  id: text('id').primaryKey(),
  requesterUserId: text('requester_user_id').references(() => users.id, { onDelete: 'set null' }),
  recipientUserId: text('recipient_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  requesterRole: text('requester_role', { enum: REQUESTER_ROLES }).notNull(),
  recipientRole: text('recipient_role', { enum: RECIPIENT_ROLES }).notNull(),
  requesterDisplayName: text('requester_display_name').notNull(),
  requesterClassSnapshot: varchar('requester_class_snapshot', { length: 80 }),
  requesterEmailSnapshot: text('requester_email_snapshot'),
  recipientDisplayName: text('recipient_display_name').notNull(),
  recipientEmailSnapshot: text('recipient_email_snapshot'),
  subjectId: text('subject_id').notNull().references(() => subjects.id),
  subjectNameSnapshot: text('subject_name_snapshot').notNull(),
  topicId: text('topic_id').references(() => topics.id),
  topicNameSnapshot: text('topic_name_snapshot'),
  title: text('title').notNull(),
  isDemo: boolean('is_demo').notNull().default(false),
  demoKey: text('demo_key'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  // One demo thread per (recipient, demoKey) - also what makes demo seeding idempotent.
  uniqueIndex('enquiry_threads_recipient_demo_key_uidx').on(table.recipientUserId, table.demoKey),
  index('enquiry_threads_recipient_updated_idx').on(table.recipientUserId, table.updatedAt),
  index('enquiry_threads_requester_updated_idx').on(table.requesterUserId, table.updatedAt),
  index('enquiry_threads_subject_topic_idx').on(table.subjectId, table.topicId),
  // Real (non-demo) threads always have a real requester; demo threads may not.
  check(
    'enquiry_threads_demo_requester_check',
    sql`${table.isDemo} = true OR ${table.requesterUserId} IS NOT NULL`,
  ),
  // The topic and its name snapshot are either both present or both absent.
  check(
    'enquiry_threads_topic_snapshot_check',
    sql`(${table.topicId} IS NULL AND ${table.topicNameSnapshot} IS NULL) OR (${table.topicId} IS NOT NULL AND ${table.topicNameSnapshot} IS NOT NULL)`,
  ),
]);

export const enquiryMessages = edunetsSchema.table('enquiry_messages', {
  id: text('id').primaryKey(),
  threadId: text('thread_id').notNull().references(() => enquiryThreads.id, { onDelete: 'cascade' }),
  senderUserId: text('sender_user_id').references(() => users.id, { onDelete: 'set null' }),
  senderRole: text('sender_role', { enum: SENDER_ROLES }).notNull(),
  senderDisplayName: text('sender_display_name').notNull(),
  senderEmailSnapshot: text('sender_email_snapshot'),
  body: text('body').notNull(),
  submissionId: text('submission_id').notNull(),
  unread: boolean('unread').notNull().default(true),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  // Client-supplied submission IDs make submit-a-message idempotent under retry.
  uniqueIndex('enquiry_messages_submission_id_uidx').on(table.submissionId),
  index('enquiry_messages_thread_created_idx').on(table.threadId, table.createdAt),
  index('enquiry_messages_thread_unread_idx').on(table.threadId, table.unread),
  check(
    'enquiry_messages_unread_read_at_check',
    sql`(${table.unread} = true AND ${table.readAt} IS NULL) OR (${table.unread} = false AND ${table.readAt} IS NOT NULL)`,
  ),
]);
