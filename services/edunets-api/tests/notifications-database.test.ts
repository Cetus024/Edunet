import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
  notificationChannelEnum,
  notifications,
  notificationTypeEnum,
} from '../../../database/schema/notifications.js';
import { buildNotificationValues } from '../src/services/notifications.js';

describe('notification database schema', () => {
  it('supports Teacher and Study Squad channels with recipient-scoped unread indexes', () => {
    const config = getTableConfig(notifications);
    expect(notificationChannelEnum.enumValues).toEqual(['teacher', 'study_squad']);
    expect(notificationTypeEnum.enumValues).toEqual(expect.arrayContaining([
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
    ]));
    expect(config.indexes.map((index) => index.config.name)).toEqual(expect.arrayContaining([
      'notifications_dedupe_key_uidx',
      'notifications_recipient_created_idx',
      'notifications_recipient_unread_idx',
    ]));
    expect(config.foreignKeys).toHaveLength(2);
  });

  it('builds bounded, unread notification rows with a stable caller dedupe key', () => {
    const row = buildNotificationValues({
      recipientUserId: 'recipient-1',
      actorUserId: 'actor-1',
      channel: 'teacher',
      type: 'teacher_reply',
      title: 'x'.repeat(200),
      body: 'Your teacher replied.',
      href: '/ask-teacher?threadId=thread-1',
      resourceId: 'thread-1',
      dedupeKey: 'teacher-message:message-1',
      createdAt: new Date('2026-09-03T10:00:00.000Z'),
    });

    expect(row.title).toHaveLength(160);
    expect(row.readAt).toBeNull();
    expect(row.dedupeKey).toBe('teacher-message:message-1');
    expect(row.createdAt.toISOString()).toBe('2026-09-03T10:00:00.000Z');
  });

  it('creates notifications in the committed 0013 migration', () => {
    const migrationPath = fileURLToPath(new URL(
      '../../../database/migrations/0013_pale_jane_foster.sql',
      import.meta.url,
    ));
    const migration = readFileSync(migrationPath, 'utf8');
    expect(migration).toContain('CREATE TABLE "edunets"."notifications"');
    expect(migration).toContain('notifications_recipient_unread_idx');
    expect(migration).toContain('notifications_dedupe_key_uidx');
  });
});
