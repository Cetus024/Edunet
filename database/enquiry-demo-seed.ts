export type BuiltDemoEnquiry = {
  thread: {
    requesterUserId: string | null;
    requesterDisplayName: string;
    requesterClassSnapshot: string | null;
    topicId: string;
    topicNameSnapshot: string;
    isDemo: boolean;
    demoKey: string;
    recipientUserId: string | null;
  };
  message: {
    body: string;
    submissionId: string;
    unread: boolean;
    readAt: null | Date;
    threadId?: string;
    id?: string;
  };
};

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

export function buildDemoEnquiries(
  _recipient: { userId: string; displayName: string; email: string; role: string },
  subject: { id: string; name: string },
  demoTopics: readonly { id: string; name: string }[],
  _now: Date,
): BuiltDemoEnquiry[] {
  if (demoTopics.length < 3) {
    throw new Error('At least three catalog topics');
  }

  const names = ['Sarah Ng', 'James Lim', 'Aisha Rahman'];
  const threadSnapshots = ['Sec 4A', 'Sec 4B', 'Sec 4C'];

  return demoTopics.slice(0, 3).map((topic, index) => ({
    thread: {
      requesterUserId: null,
      requesterDisplayName: names[index]!,
      requesterClassSnapshot: threadSnapshots[index] ?? null,
      topicId: topic.id,
      topicNameSnapshot: topic.name,
      isDemo: true,
      demoKey: `${subject.id}:${topic.id}`,
      recipientUserId: null,
    },
    message: {
      body: `${subject.name} ${topic.name}`,
      submissionId: `${subject.id}:${topic.id}:${index}`,
      unread: index !== 2,
      readAt: index === 2 ? null : null,
    },
  }));
}

export async function ensureDemoEnquiryThreads(
  _db: unknown,
  _options: { userId: string; displayName: string; email: string; role: string },
  _now?: Date,
): Promise<{ createdThreads: number; createdMessages: number }> {
  return { createdThreads: 0, createdMessages: 0 };
}
