import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { getTableConfig } from 'drizzle-orm/pg-core';
import { describe, expect, it } from 'vitest';

import {
  buildDemoEnquiries,
  type BuiltDemoEnquiry,
  type EnquiryDemoExecutor,
  ensureDemoEnquiryThreads,
} from '../../../database/enquiry-demo-seed.js';
import {
  enquiryMessages,
  enquiryRecipientRoleEnum,
  enquiryRequesterRoleEnum,
  enquirySenderRoleEnum,
  enquiryThreads,
  onboardingProfiles,
  subjects,
  topics,
} from '../../../database/schema/index.js';

const fixedNow = new Date('2026-07-31T08:00:00.000Z');
const recipient = {
  userId: 'recipient-1',
  displayName: 'Ms. Demo Teacher',
  email: 'teacher@example.test',
  role: 'teacher' as const,
};
const subject = { id: 'bio', name: 'Biology' };
const demoTopics = [
  { id: 'bio-cell', name: 'Cell Division (Mitosis)' },
  { id: 'bio-genetics', name: 'Genetics' },
  { id: 'bio-ecology', name: 'Ecology' },
] as const;

describe('enquiry database schema', () => {
  it('restricts recipient roles and supports nullable demo requesters', () => {
    expect(enquiryRequesterRoleEnum.enumValues).toEqual(['student', 'parent']);
    expect(enquiryRecipientRoleEnum.enumValues).toEqual(['teacher', 'tutor']);
    expect(enquirySenderRoleEnum.enumValues).toEqual([
      'student',
      'parent',
      'teacher',
      'tutor',
    ]);
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
    expect(messageConfig.checks.map((check) => check.name)).toContain(
      'enquiry_messages_unread_read_at_check',
    );
  });

  it('has a strictly additive committed migration', () => {
    const migrationPath = fileURLToPath(new URL(
      '../../../database/migrations/0001_teacher_tutor_enquiries.sql',
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

describe('demo enquiry seed', () => {
  it('builds the three named, subject/topic-aware snapshot threads', () => {
    const rows = buildDemoEnquiries(recipient, subject, demoTopics, fixedNow);

    expect(rows).toHaveLength(3);
    expect(rows.map((row) => row.thread.requesterDisplayName)).toEqual([
      'Sarah Ng',
      'James Lim',
      'Aisha Rahman',
    ]);
    expect(rows.map((row) => row.thread.requesterClassSnapshot)).toEqual([
      'Sec 4A',
      'Sec 4B',
      'Sec 4C',
    ]);
    expect(rows.map((row) => row.thread.topicId)).toEqual(demoTopics.map(({ id }) => id));
    expect(rows.every((row) => row.thread.requesterUserId === null)).toBe(true);
    expect(rows.every((row) => row.thread.isDemo)).toBe(true);
    expect(rows.every((row) => row.message.body.includes(subject.name))).toBe(true);
    expect(rows.every((row) => row.message.body.includes(row.thread.topicNameSnapshot))).toBe(true);
    expect(rows.map((row) => row.message.unread)).toEqual([true, true, false]);
    expect(rows.map((row) => row.message.readAt === null)).toEqual([true, true, false]);
    expect(new Set(rows.map((row) => row.thread.demoKey)).size).toBe(3);
    expect(new Set(rows.map((row) => row.message.submissionId)).size).toBe(3);
  });

  it('produces stable recipient-scoped submission IDs', () => {
    const first = buildDemoEnquiries(recipient, subject, demoTopics, fixedNow);
    const repeat = buildDemoEnquiries(recipient, subject, demoTopics, fixedNow);
    const otherRecipient = buildDemoEnquiries(
      { ...recipient, userId: 'recipient-2', role: 'tutor' },
      subject,
      demoTopics,
      fixedNow,
    );

    expect(repeat.map((row) => row.message.submissionId)).toEqual(
      first.map((row) => row.message.submissionId),
    );
    expect(otherRecipient.map((row) => row.message.submissionId)).not.toEqual(
      first.map((row) => row.message.submissionId),
    );
  });

  it('requires enough catalog topics to produce exactly three threads', () => {
    expect(() => buildDemoEnquiries(recipient, subject, demoTopics.slice(0, 2), fixedNow))
      .toThrow('At least three catalog topics');
  });

  it('is idempotent per recipient and preserves the preferred onboarding topic', async () => {
    const executor = new FakeDemoExecutor();

    const first = await ensureDemoEnquiryThreads(
      executor as unknown as EnquiryDemoExecutor,
      recipient,
      fixedNow,
    );
    const repeat = await ensureDemoEnquiryThreads(
      executor as unknown as EnquiryDemoExecutor,
      recipient,
      fixedNow,
    );

    expect(first).toEqual({ createdThreads: 3, createdMessages: 3 });
    expect(repeat).toEqual({ createdThreads: 0, createdMessages: 0 });
    expect(executor.threadRows).toHaveLength(3);
    expect(executor.messageRows).toHaveLength(3);
    expect(executor.threadRows[0]?.topicId).toBe('bio-genetics');
  });
});

type StoredThread = BuiltDemoEnquiry['thread'] & {
  id: string;
};

type StoredMessage = BuiltDemoEnquiry['message'] & {
  id: string;
  threadId: string;
};

class FakeDemoExecutor {
  readonly threadRows: StoredThread[] = [];
  readonly messageRows: StoredMessage[] = [];
  private lastThreadLookup: { recipientUserId: string | null; demoKey: string } | null = null;

  select(): { from: (table: unknown) => FakeSelectChain } {
    return {
      from: (table) => {
        if (table === onboardingProfiles) {
          return createSelectChain([{ subjectId: 'bio', topicId: 'bio-genetics' }]);
        }
        if (table === subjects) {
          return createSelectChain([{ id: 'bio', name: 'Biology' }]);
        }
        if (table === topics) {
          return createSelectChain([
            { id: 'bio-cell', name: 'Cell Division (Mitosis)' },
            { id: 'bio-genetics', name: 'Genetics' },
            { id: 'bio-ecology', name: 'Ecology' },
            { id: 'bio-transport', name: 'Transport' },
          ]);
        }
        if (table === enquiryThreads) {
          const matchingThreads = this.lastThreadLookup
            ? this.threadRows.filter((thread) => (
                thread.recipientUserId === this.lastThreadLookup?.recipientUserId
                && thread.demoKey === this.lastThreadLookup.demoKey
              ))
            : [];
          return createSelectChain(matchingThreads.map(({ id }) => ({ id })));
        }
        throw new Error('Unexpected table in fake select.');
      },
    };
  }

  insert(table: unknown): {
    values: (value: unknown) => {
      onConflictDoNothing: () => { returning: () => Promise<Array<{ id: string }>> };
    };
  } {
    return {
      values: (value) => {
        if (table === enquiryThreads) {
          const thread = value as BuiltDemoEnquiry['thread'];
          this.lastThreadLookup = {
            recipientUserId: thread.recipientUserId,
            demoKey: thread.demoKey,
          };
        }

        return {
          onConflictDoNothing: () => ({
            returning: async () => {
            if (table === enquiryThreads) {
              const thread = value as BuiltDemoEnquiry['thread'];
              const existing = this.threadRows.find((candidate) => (
                candidate.recipientUserId === thread.recipientUserId
                && candidate.demoKey === thread.demoKey
              ));
              if (existing) return [];

              const stored = { ...thread, id: `thread-${this.threadRows.length + 1}` };
              this.threadRows.push(stored);
              return [{ id: stored.id }];
            }

            if (table === enquiryMessages) {
              const message = value as BuiltDemoEnquiry['message'] & { threadId: string };
              const existing = this.messageRows.find((candidate) => (
                candidate.submissionId === message.submissionId
              ));
              if (existing) return [];

              const stored = { ...message, id: `message-${this.messageRows.length + 1}` };
              this.messageRows.push(stored);
              return [{ id: stored.id }];
            }

            throw new Error('Unexpected table in fake insert.');
            },
          }),
        };
      },
    };
  }
}

interface FakeSelectChain {
  where: () => FakeSelectChain;
  orderBy: () => Promise<unknown[]>;
  limit: (limit: number) => Promise<unknown[]>;
}

function createSelectChain(rows: unknown[]): FakeSelectChain {
  const chain: FakeSelectChain = {
    where: () => chain,
    orderBy: async () => rows,
    limit: async (limit) => rows.slice(0, limit),
  };
  return chain;
}
