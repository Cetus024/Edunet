import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
  enquiryMessages,
  enquiryRecipientRoleEnum,
  enquiryRequesterRoleEnum,
  enquirySenderRoleEnum,
  enquiryThreads,
} from '../../../database/schema/index.js';

describe('enquiry database schema', () => {
  it('restricts recipient roles and supports nullable legacy demo requesters', () => {
    expect(enquiryRequesterRoleEnum.enumValues).toEqual(['student']);
    expect(enquiryRecipientRoleEnum.enumValues).toEqual(['teacher']);
    expect(enquirySenderRoleEnum.enumValues).toEqual(['student', 'teacher']);
    expect(enquiryThreads.requesterUserId.notNull).toBe(false);
    expect(enquiryThreads.recipientUserId.notNull).toBe(true);
    expect(enquiryThreads.requesterClassSnapshot.notNull).toBe(false);
    expect(enquiryMessages.submissionId.notNull).toBe(true);
    expect(enquiryMessages.unread.notNull).toBe(true);
    expect(enquiryMessages.readAt.notNull).toBe(false);
  });

  it('installs the ownership, idempotency, read-state, and lookup constraints', () => {
    const threadConfig = getTableConfig(enquiryThreads);
    const messageConfig = getTableConfig(enquiryMessages);

    expect(threadConfig.foreignKeys).toHaveLength(4);
    expect(threadConfig.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        'enquiry_threads_recipient_demo_key_uidx',
        'enquiry_threads_recipient_updated_idx',
        'enquiry_threads_requester_updated_idx',
        'enquiry_threads_subject_topic_idx',
      ]),
    );
    expect(threadConfig.checks.map((check) => check.name)).toEqual(
      expect.arrayContaining([
        'enquiry_threads_demo_requester_check',
        'enquiry_threads_topic_snapshot_check',
        'enquiry_threads_requester_role_check',
        'enquiry_threads_recipient_role_check',
      ]),
    );

    expect(messageConfig.foreignKeys).toHaveLength(2);
    expect(messageConfig.indexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        'enquiry_messages_submission_id_uidx',
        'enquiry_messages_thread_created_idx',
        'enquiry_messages_thread_unread_idx',
      ]),
    );
    expect(messageConfig.checks.map((check) => check.name)).toEqual(expect.arrayContaining([
      'enquiry_messages_unread_read_at_check',
      'enquiry_messages_sender_role_check',
    ]));
  });

  it('installs enquiries through the original additive migration', () => {
    const migrationPath = fileURLToPath(new URL(
      '../../../database/migrations/0004_teacher_tutor_enquiries.sql',
      import.meta.url,
    ));
    const migration = readFileSync(migrationPath, 'utf8');

    expect(migration).toContain('CREATE TABLE "edunets"."enquiry_threads"');
    expect(migration).toContain('CREATE TABLE "edunets"."enquiry_messages"');
    expect(migration).toContain('"requester_class_snapshot" varchar(80)');
    expect(migration).toContain('enquiry_messages_submission_id_uidx');
    expect(migration).not.toMatch(/\b(?:DROP|TRUNCATE)\b|\bDELETE\s+FROM\b/i);
  });
});
