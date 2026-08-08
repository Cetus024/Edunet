import { boolean, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const enquiryThreads = pgTable('enquiry_thread', {
  id: text('id').primaryKey(),
  requesterUserId: text('requester_user_id'),
  recipientUserId: text('recipient_user_id'),
  requesterRole: text('requester_role'),
  recipientRole: text('recipient_role'),
  requesterDisplayName: text('requester_display_name').notNull(),
  requesterClassSnapshot: text('requester_class_snapshot'),
  requesterEmailSnapshot: text('requester_email_snapshot'),
  recipientDisplayName: text('recipient_display_name').notNull(),
  recipientEmailSnapshot: text('recipient_email_snapshot'),
  subjectId: text('subject_id'),
  subjectNameSnapshot: text('subject_name_snapshot'),
  topicId: text('topic_id'),
  topicNameSnapshot: text('topic_name_snapshot'),
  title: text('title').notNull(),
  isDemo: boolean('is_demo').notNull().default(false),
  demoKey: text('demo_key'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const enquiryMessages = pgTable('enquiry_message', {
  id: text('id').primaryKey(),
  threadId: text('thread_id').notNull().references(() => enquiryThreads.id, { onDelete: 'cascade' }),
  senderUserId: text('sender_user_id'),
  senderRole: text('sender_role').notNull(),
  senderDisplayName: text('sender_display_name').notNull(),
  senderEmailSnapshot: text('sender_email_snapshot'),
  body: text('body').notNull(),
  submissionId: text('submission_id').unique(),
  unread: boolean('unread').notNull().default(true),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const enquiryRequesterRoleEnum = {
  enumValues: ['student', 'parent'] as const,
};

export const enquiryRecipientRoleEnum = {
  enumValues: ['teacher', 'tutor'] as const,
};

export const enquirySenderRoleEnum = {
  enumValues: ['student', 'parent', 'teacher', 'tutor'] as const,
};
