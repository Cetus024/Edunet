export type RequesterRole = 'student';
export type RecipientRole = 'teacher';
export type EnquiryRole = RequesterRole | RecipientRole;

export type EnquiryActor = {
  userId: string;
  name: string;
  role: EnquiryRole;
  schoolId: string;
  subjectId: string;
};

export type DirectoryCandidate = {
  userId: string;
  name: string;
  role: RecipientRole;
  schoolId: string;
  subjectId: string;
  subjectName: string;
};

export type QuestionRecipient = {
  id: string;
  name: string;
  role: RecipientRole;
  schoolId: string;
  subjectId: string;
  subjectName: string;
};

export type ThreadRecord = {
  id: string;
  requesterUserId: string | null;
  recipientUserId: string;
  requesterRole: RequesterRole;
  recipientRole: RecipientRole;
  requesterDisplayName: string;
  requesterClassName: string | null;
  recipientDisplayName: string;
  subjectId: string;
  subjectName: string;
  topicId: string | null;
  topicName: string | null;
  title: string;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type MessageRecord = {
  id: string;
  threadId: string;
  senderUserId: string | null;
  senderRole: EnquiryRole;
  senderDisplayName: string;
  body: string;
  unread: boolean;
  createdAt: Date;
};

export type EnquiryMessageResponse = {
  id: string;
  sender: {
    id: string | null;
    name: string;
    role: EnquiryRole;
  };
  body: string;
  createdAt: string;
  isRead: boolean;
};

export type EnquiryThreadResponse = {
  id: string;
  isDemo: boolean;
  title: string;
  subject: { id: string; name: string };
  topic: { id: string; name: string } | null;
  requester: {
    id: string | null;
    name: string;
    role: RequesterRole;
    className: string | null;
  };
  recipient: {
    id: string;
    name: string;
    role: RecipientRole;
  };
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  messages: EnquiryMessageResponse[];
};

export function isRequesterRole(role: string | null): role is RequesterRole {
  return role === 'student';
}

export function isRecipientRole(role: string | null): role is RecipientRole {
  return role === 'teacher';
}

export function canAccessThread(
  actor: Pick<EnquiryActor, 'userId' | 'role'>,
  thread: Pick<ThreadRecord, 'requesterUserId' | 'recipientUserId' | 'isDemo'>,
): boolean {
  if (isRequesterRole(actor.role)) {
    return !thread.isDemo && thread.requesterUserId === actor.userId;
  }
  return thread.recipientUserId === actor.userId;
}

type PriorSubmission = {
  messageId: string;
  threadId: string;
  senderUserId: string | null;
  requesterUserId: string | null;
  isDemo: boolean;
};

export function isCreateSubmissionReplay(
  actorUserId: string,
  prior: PriorSubmission,
  firstMessageId: string | undefined,
): boolean {
  return prior.messageId === firstMessageId
    && prior.senderUserId === actorUserId
    && prior.requesterUserId === actorUserId
    && !prior.isDemo;
}

export function isReplySubmissionReplay(
  actorUserId: string,
  threadId: string,
  prior: PriorSubmission,
  firstMessageId: string | undefined,
): boolean {
  return prior.messageId !== firstMessageId
    && prior.senderUserId === actorUserId
    && prior.threadId === threadId;
}

export function selectQuestionRecipients(
  candidates: readonly DirectoryCandidate[],
  requesterSchoolId: string,
): { scope: 'school' | 'global'; recipients: QuestionRecipient[] } {
  const sameSchool = candidates.filter((candidate) => candidate.schoolId === requesterSchoolId);
  const selected = sameSchool.length > 0 ? sameSchool : candidates;

  return {
    scope: sameSchool.length > 0 ? 'school' : 'global',
    recipients: [...selected]
      .sort((left, right) => left.name.localeCompare(right.name, 'en')
        || left.role.localeCompare(right.role)
        || left.userId.localeCompare(right.userId))
      .map((candidate) => ({
        id: candidate.userId,
        name: candidate.name,
        role: candidate.role,
        schoolId: candidate.schoolId,
        subjectId: candidate.subjectId,
        subjectName: candidate.subjectName,
      })),
  };
}

export function makeEnquiryTitle(body: string): string {
  const normalized = body.replace(/\s+/g, ' ').trim();
  if (normalized.length <= 80) return normalized;
  return `${normalized.slice(0, 77).trimEnd()}...`;
}

function isIncomingMessage(viewerRole: EnquiryRole, senderRole: EnquiryRole): boolean {
  return isRequesterRole(viewerRole)
    ? isRecipientRole(senderRole)
    : isRequesterRole(senderRole);
}

export function serializeMessage(
  message: MessageRecord,
  viewer: Pick<EnquiryActor, 'userId' | 'role'>,
): EnquiryMessageResponse {
  const isOwnMessage = message.senderUserId === viewer.userId;
  return {
    id: message.id,
    sender: {
      id: message.senderUserId,
      name: message.senderDisplayName,
      role: message.senderRole,
    },
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    isRead: isOwnMessage || !message.unread,
  };
}

export function serializeThread(
  thread: ThreadRecord,
  messages: readonly MessageRecord[],
  viewer: Pick<EnquiryActor, 'userId' | 'role'>,
): EnquiryThreadResponse {
  return {
    id: thread.id,
    isDemo: thread.isDemo,
    title: thread.title,
    subject: { id: thread.subjectId, name: thread.subjectName },
    topic: thread.topicId && thread.topicName
      ? { id: thread.topicId, name: thread.topicName }
      : null,
    requester: {
      id: thread.requesterUserId,
      name: thread.requesterDisplayName,
      role: thread.requesterRole,
      className: thread.requesterClassName,
    },
    recipient: {
      id: thread.recipientUserId,
      name: thread.recipientDisplayName,
      role: thread.recipientRole,
    },
    unreadCount: messages.filter((message) => (
      message.unread && isIncomingMessage(viewer.role, message.senderRole)
    )).length,
    createdAt: thread.createdAt.toISOString(),
    updatedAt: thread.updatedAt.toISOString(),
    messages: messages.map((message) => serializeMessage(message, viewer)),
  };
}
