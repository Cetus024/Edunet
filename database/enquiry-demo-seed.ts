import { randomUUID } from 'node:crypto';

import { and, eq } from 'drizzle-orm';

import { subjects, topics } from './schema/catalog.js';
import { enquiryMessages, enquiryThreads } from './schema/enquiries.js';
import { onboardingProfiles } from './schema/learning.js';

export type BuiltDemoEnquiry = {
  thread: {
    requesterUserId: string | null;
    recipientUserId: string;
    requesterRole: 'student' | 'parent';
    recipientRole: string;
    requesterDisplayName: string;
    requesterClassSnapshot: string | null;
    recipientDisplayName: string;
    recipientEmailSnapshot: string | null;
    topicId: string;
    topicNameSnapshot: string;
    subjectId: string;
    subjectNameSnapshot: string;
    title: string;
    isDemo: boolean;
    demoKey: string;
  };
  message: {
    senderUserId: string | null;
    senderRole: 'student' | 'parent';
    senderDisplayName: string;
    body: string;
    submissionId: string;
    unread: boolean;
    readAt: null | Date;
    threadId?: string;
    id?: string;
  };
};

export interface DemoRecipient {
  userId: string;
  displayName: string;
  email: string;
  role: string;
}

export interface EnquiryDemoExecutor {
  threadRows: Array<{ id: string; recipientUserId: string | null; demoKey: string; topicId: string }>;
  messageRows: Array<{
    id: string;
    threadId: string;
    submissionId: string;
    unread: boolean;
    readAt: null | Date;
  }>;
  select(): { from: (table: unknown) => unknown };
  insert(table: unknown): {
    values: (value: unknown) => {
      onConflictDoNothing: () => { returning: () => Promise<Array<{ id: string }>> };
    };
  };
}

const DEMO_REQUESTERS: ReadonlyArray<{ name: string; classSnapshot: string }> = [
  { name: 'Sarah Ng', classSnapshot: 'Sec 4A' },
  { name: 'James Lim', classSnapshot: 'Sec 4B' },
  { name: 'Aisha Rahman', classSnapshot: 'Sec 4C' },
];

export function buildDemoEnquiries(
  recipient: DemoRecipient,
  subject: { id: string; name: string },
  demoTopics: readonly { id: string; name: string }[],
  now: Date,
): BuiltDemoEnquiry[] {
  if (demoTopics.length < 3) {
    throw new Error('At least three catalog topics are required to build demo enquiries.');
  }

  return demoTopics.slice(0, 3).map((topic, index) => {
    const requester = DEMO_REQUESTERS[index]!;
    const isRead = index === 2;
    const demoKey = `${subject.id}:${topic.id}`;

    return {
      thread: {
        requesterUserId: null,
        recipientUserId: recipient.userId,
        requesterRole: 'student',
        recipientRole: recipient.role,
        requesterDisplayName: requester.name,
        requesterClassSnapshot: requester.classSnapshot,
        recipientDisplayName: recipient.displayName,
        recipientEmailSnapshot: recipient.email,
        topicId: topic.id,
        topicNameSnapshot: topic.name,
        subjectId: subject.id,
        subjectNameSnapshot: subject.name,
        title: `${subject.name}: ${topic.name}`,
        isDemo: true,
        demoKey,
      },
      message: {
        senderUserId: null,
        senderRole: 'student',
        senderDisplayName: requester.name,
        body: `${requester.name} asks about ${subject.name}: ${topic.name}`,
        submissionId: `${recipient.userId}:${subject.id}:${topic.id}:${index}`,
        unread: !isRead,
        readAt: isRead ? now : null,
      },
    };
  });
}

/**
 * Ensures every Teacher/Tutor account has three labelled demo enquiry
 * threads to review, seeded from a real onboarding profile's subject/topic
 * so the demo content feels representative rather than arbitrary. Safe to
 * call repeatedly: threads are keyed by (recipient, demoKey) and messages by
 * submissionId, so a repeat call creates nothing new.
 */
export async function ensureDemoEnquiryThreads(
  db: unknown,
  recipient: DemoRecipient,
  now: Date = new Date(),
): Promise<{ createdThreads: number; createdMessages: number }> {
  const executor = db as EnquiryDemoExecutor;

  const onboardingRows = await (executor.select().from(onboardingProfiles) as {
    limit: (limit: number) => Promise<Array<{ subjectId: string; topicId: string }>>;
  }).limit(1);
  const preferred = onboardingRows[0];
  if (!preferred) return { createdThreads: 0, createdMessages: 0 };

  const subjectRows = await (executor.select().from(subjects) as {
    where: (...args: unknown[]) => { limit: (limit: number) => Promise<Array<{ id: string; name: string }>> };
  }).where(eq(subjects.id, preferred.subjectId)).limit(1);
  const subject = subjectRows[0];
  if (!subject) return { createdThreads: 0, createdMessages: 0 };

  const topicRows = await (executor.select().from(topics) as {
    where: (...args: unknown[]) => {
      orderBy: (...args: unknown[]) => Promise<Array<{ id: string; name: string }>>;
    };
  }).where(eq(topics.subjectId, subject.id)).orderBy(topics.position);
  if (topicRows.length < 3) return { createdThreads: 0, createdMessages: 0 };

  const preferredTopic = topicRows.find((topic) => topic.id === preferred.topicId);
  const remainingTopics = topicRows.filter((topic) => topic.id !== preferred.topicId);
  const chosenTopics = preferredTopic
    ? [preferredTopic, ...remainingTopics].slice(0, 3)
    : topicRows.slice(0, 3);

  const built = buildDemoEnquiries(recipient, subject, chosenTopics, now);

  let createdThreads = 0;
  let createdMessages = 0;

  for (const { thread, message } of built) {
    const [insertedThread] = await executor.insert(enquiryThreads)
      .values({ id: randomUUID(), ...thread })
      .onConflictDoNothing()
      .returning();

    let threadId: string | undefined;
    if (insertedThread) {
      threadId = insertedThread.id;
      createdThreads += 1;
    } else {
      const [existingThread] = await (executor.select().from(enquiryThreads) as {
        where: (...args: unknown[]) => { limit: (limit: number) => Promise<Array<{ id: string }>> };
      }).where(and(
        eq(enquiryThreads.recipientUserId, thread.recipientUserId),
        eq(enquiryThreads.demoKey, thread.demoKey),
      )).limit(1);
      threadId = existingThread?.id;
    }

    if (!threadId) continue;

    const [insertedMessage] = await executor.insert(enquiryMessages)
      .values({ id: randomUUID(), ...message, threadId })
      .onConflictDoNothing()
      .returning();
    if (insertedMessage) createdMessages += 1;
  }

  return { createdThreads, createdMessages };
}
