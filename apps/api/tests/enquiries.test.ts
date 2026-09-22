import { describe, expect, it } from 'vitest';

import {
  canAccessThread,
  isCreateSubmissionReplay,
  isReplySubmissionReplay,
  makeEnquiryTitle,
  selectQuestionRecipients,
  serializeThread,
  type DirectoryCandidate,
  type MessageRecord,
  type ThreadRecord,
} from '../src/lib/enquiries.js';

const candidates: DirectoryCandidate[] = [
  {
    userId: 'teacher-global',
    name: 'Global Teacher',
    role: 'teacher',
    schoolId: 'school-b',
    subjectId: 'amath',
    subjectName: 'Additional Mathematics',
  },
  {
    userId: 'tutor-school',
    name: 'School Tutor',
    role: 'tutor',
    schoolId: 'school-a',
    subjectId: 'amath',
    subjectName: 'Additional Mathematics',
  },
];

const thread: ThreadRecord = {
  id: 'thread-1',
  requesterUserId: 'student-1',
  recipientUserId: 'teacher-1',
  requesterRole: 'student',
  recipientRole: 'teacher',
  requesterDisplayName: 'Student One',
  requesterClassName: null,
  recipientDisplayName: 'Teacher One',
  subjectId: 'amath',
  subjectName: 'Additional Mathematics',
  topicId: 'amath-trig',
  topicName: 'Trigonometry',
  title: 'How do I begin?',
  isDemo: false,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  updatedAt: new Date('2026-01-01T00:01:00.000Z'),
};

describe('question recipient directory', () => {
  it('returns only matching-school recipients when any are available', () => {
    const result = selectQuestionRecipients(candidates, 'school-a');
    expect(result.scope).toBe('school');
    expect(result.recipients.map((recipient) => recipient.id)).toEqual(['tutor-school']);
  });

  it('falls back to all same-subject candidates and never copies undeclared fields', () => {
    const rows = candidates.map((candidate) => ({ ...candidate, email: `${candidate.userId}@test.invalid` }));
    const result = selectQuestionRecipients(rows, 'school-c');
    expect(result.scope).toBe('global');
    expect(result.recipients).toHaveLength(2);
    expect(result.recipients.every((recipient) => !('email' in recipient))).toBe(true);
  });
});

describe('enquiry authorization', () => {
  it('lets requesters see only their own real thread', () => {
    expect(canAccessThread({ userId: 'student-1', role: 'student' }, thread)).toBe(true);
    expect(canAccessThread({ userId: 'student-2', role: 'student' }, thread)).toBe(false);
    expect(canAccessThread(
      { userId: 'student-1', role: 'student' },
      { ...thread, isDemo: true },
    )).toBe(false);
  });

  it('lets a teacher or tutor see only an assigned thread', () => {
    expect(canAccessThread({ userId: 'teacher-1', role: 'teacher' }, thread)).toBe(true);
    expect(canAccessThread({ userId: 'teacher-2', role: 'teacher' }, thread)).toBe(false);
  });
});

describe('enquiry submission idempotency', () => {
  const initial = {
    messageId: 'message-initial',
    threadId: 'thread-1',
    senderUserId: 'student-1',
    requesterUserId: 'student-1',
    isDemo: false,
  };

  it('replays only the original create submission for the same requester', () => {
    expect(isCreateSubmissionReplay('student-1', initial, 'message-initial')).toBe(true);
    expect(isCreateSubmissionReplay('student-2', initial, 'message-initial')).toBe(false);
    expect(isCreateSubmissionReplay('student-1', initial, 'another-message')).toBe(false);
  });

  it('replays only a non-initial reply from the same actor and thread', () => {
    const reply = { ...initial, messageId: 'message-reply', senderUserId: 'teacher-1' };
    expect(isReplySubmissionReplay('teacher-1', 'thread-1', reply, 'message-initial')).toBe(true);
    expect(isReplySubmissionReplay('teacher-2', 'thread-1', reply, 'message-initial')).toBe(false);
    expect(isReplySubmissionReplay('teacher-1', 'thread-2', reply, 'message-initial')).toBe(false);
    expect(isReplySubmissionReplay('student-1', 'thread-1', initial, 'message-initial')).toBe(false);
  });
});

describe('enquiry response mapping', () => {
  const messages: MessageRecord[] = [
    {
      id: 'message-1',
      threadId: thread.id,
      senderUserId: 'student-1',
      senderRole: 'student',
      senderDisplayName: 'Student One',
      body: 'How do I begin?',
      unread: true,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    {
      id: 'message-2',
      threadId: thread.id,
      senderUserId: 'teacher-1',
      senderRole: 'teacher',
      senderDisplayName: 'Teacher One',
      body: 'Start by drawing a diagram.',
      unread: true,
      createdAt: new Date('2026-01-01T00:01:00.000Z'),
    },
  ];

  it('counts only incoming unread messages and returns ISO timestamps', () => {
    const response = serializeThread(thread, messages, { userId: 'teacher-1', role: 'teacher' });
    expect(response.unreadCount).toBe(1);
    expect(response.createdAt).toBe('2026-01-01T00:00:00.000Z');
    expect(response.messages[1]?.isRead).toBe(true);
  });

  it('represents demo requesters and messages without fake user IDs', () => {
    const response = serializeThread(
      {
        ...thread,
        requesterUserId: null,
        requesterDisplayName: 'Demo Student',
        requesterClassName: 'Sec 4A',
        isDemo: true,
      },
      [{ ...messages[0]!, senderUserId: null, senderDisplayName: 'Demo Student' }],
      { userId: 'teacher-1', role: 'teacher' },
    );
    expect(response.requester.id).toBeNull();
    expect(response.requester.className).toBe('Sec 4A');
    expect(response.messages[0]?.sender.id).toBeNull();
    expect(JSON.stringify(response)).not.toContain('@');
  });

  it('derives a bounded title from the first message', () => {
    expect(makeEnquiryTitle('  A question\nwith   spacing  ')).toBe('A question with spacing');
    expect(makeEnquiryTitle('x'.repeat(100))).toHaveLength(80);
  });
});
