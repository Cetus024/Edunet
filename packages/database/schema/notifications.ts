import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgSchema,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

import { EDUNETS_SCHEMA_NAME } from '../constants.js';
import { users } from './auth.js';

const edunetsSchema = pgSchema(EDUNETS_SCHEMA_NAME);

const NOTIFICATION_CHANNELS = ['teacher', 'study_squad'] as const;
const NOTIFICATION_TYPES = [
  'teacher_enquiry',
  'teacher_reply',
  'squad_invitation',
  'squad_invitation_accepted',
  'squad_invitation_declined',
  'squad_streak_restored',
  'squad_quiz_invitation',
  'squad_quiz_finished',
  'revision_room_invitation',
  'revision_room_started',
] as const;

export const notificationChannelEnum = { enumValues: NOTIFICATION_CHANNELS };
export const notificationTypeEnum = { enumValues: NOTIFICATION_TYPES };

export const notifications = edunetsSchema.table('notifications', {
  id: text('id').primaryKey(),
  recipientUserId: text('recipient_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  channel: text('channel', { enum: NOTIFICATION_CHANNELS }).notNull(),
  type: text('type', { enum: NOTIFICATION_TYPES }).notNull(),
  title: varchar('title', { length: 160 }).notNull(),
  body: text('body').notNull(),
  href: varchar('href', { length: 500 }).notNull(),
  resourceId: text('resource_id'),
  dedupeKey: varchar('dedupe_key', { length: 200 }).notNull(),
  readAt: timestamp('read_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('notifications_dedupe_key_uidx').on(table.dedupeKey),
  index('notifications_recipient_created_idx').on(table.recipientUserId, table.createdAt),
  index('notifications_recipient_unread_idx')
    .on(table.recipientUserId, table.createdAt)
    .where(sql`${table.readAt} is null`),
  check('notifications_channel_check', sql`${table.channel} in ('teacher', 'study_squad')`),
  check(
    'notifications_type_check',
    sql`${table.type} in ('teacher_enquiry', 'teacher_reply', 'squad_invitation', 'squad_invitation_accepted', 'squad_invitation_declined', 'squad_streak_restored', 'squad_quiz_invitation', 'squad_quiz_finished', 'revision_room_invitation', 'revision_room_started')`,
  ),
  check('notifications_href_check', sql`${table.href} like '/%'`),
]);
