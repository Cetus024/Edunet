import { randomUUID } from 'node:crypto';

import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';

import { db } from '../../../../database/index.js';
import { users } from '../../../../database/schema/auth.js';
import { subjects, topics } from '../../../../database/schema/catalog.js';
import { enquiryMessages, enquiryThreads } from '../../../../database/schema/enquiries.js';
import { onboardingProfiles, profiles, teachingScopes } from '../../../../database/schema/learning.js';
import { notifications } from '../../../../database/schema/notifications.js';
import { ApiError } from '../errors.js';
import {
  canAccessThread,
  isRecipientRole,
  isCreateSubmissionReplay,
  isReplySubmissionReplay,
  isRequesterRole,
  makeEnquiryTitle,
  selectQuestionRecipients,
  serializeMessage,
  serializeThread,
  type DirectoryCandidate,
  type EnquiryActor,
  type EnquiryMessageResponse,
  type EnquiryThreadResponse,
  type MessageRecord,
  type QuestionRecipient,
  type ThreadRecord,
} from '../lib/enquiries.js';
import type {
  CreateEnquiryRequest,
  SendEnquiryMessageRequest,
} from '../validation.js';
import { buildNotificationValues } from './notifications.js';

type EnquiryActorWithEmail = EnquiryActor & { email: string };

type InternalDirectoryCandidate = DirectoryCandidate & { email: string };

const threadSelection = {
  id: enquiryThreads.id,
  requesterUserId: enquiryThreads.requesterUserId,
  recipientUserId: enquiryThreads.recipientUserId,
  requesterRole: enquiryThreads.requesterRole,
  recipientRole: enquiryThreads.recipientRole,
  requesterDisplayName: enquiryThreads.requesterDisplayName,
  requesterClassName: enquiryThreads.requesterClassSnapshot,
  recipientDisplayName: enquiryThreads.recipientDisplayName,
  subjectId: enquiryThreads.subjectId,
  subjectName: enquiryThreads.subjectNameSnapshot,
  topicId: enquiryThreads.topicId,
  topicName: enquiryThreads.topicNameSnapshot,
  title: enquiryThreads.title,
  isDemo: enquiryThreads.isDemo,
  createdAt: enquiryThreads.createdAt,
  updatedAt: enquiryThreads.updatedAt,
};

const messageSelection = {
  id: enquiryMessages.id,
  threadId: enquiryMessages.threadId,
  senderUserId: enquiryMessages.senderUserId,
  senderRole: enquiryMessages.senderRole,
  senderDisplayName: enquiryMessages.senderDisplayName,
  body: enquiryMessages.body,
  unread: enquiryMessages.unread,
  createdAt: enquiryMessages.createdAt,
};

export async function loadEnquiryActor(userId: string): Promise<EnquiryActorWithEmail> {
  const [row] = await db.select({
    userId: users.id,
    name: users.name,
    email: users.email,
    role: profiles.role,
    schoolId: profiles.schoolId,
    onboardingCompleted: profiles.onboardingCompleted,
    subjectId: onboardingProfiles.subjectId,
  })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .innerJoin(onboardingProfiles, eq(onboardingProfiles.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  if (!row?.onboardingCompleted
    || !row.schoolId
    || !row.subjectId
    || (!isRequesterRole(row.role) && !isRecipientRole(row.role))) {
    throw new ApiError(409, 'ONBOARDING_REQUIRED', 'Complete onboarding before using enquiries.');
  }

  return {
    userId: row.userId,
    name: row.name,
    email: row.email,
    role: row.role,
    schoolId: row.schoolId,
    subjectId: row.subjectId,
  };
}

async function loadDirectoryCandidates(subjectId: string): Promise<{
  subject: { id: string; name: string };
  candidates: InternalDirectoryCandidate[];
}> {
  const [subject] = await db.select({ id: subjects.id, name: subjects.name })
    .from(subjects)
    .where(eq(subjects.id, subjectId))
    .limit(1);

  if (!subject) throw new ApiError(400, 'INVALID_SUBJECT', 'Subject was not found.');

  const rows = await db.select({
    userId: users.id,
    name: users.name,
    email: users.email,
    role: profiles.role,
    schoolId: teachingScopes.schoolId,
    subjectId: teachingScopes.subjectId,
  })
    .from(users)
    .innerJoin(profiles, eq(profiles.userId, users.id))
    .innerJoin(teachingScopes, eq(teachingScopes.userId, users.id))
    .where(and(
      eq(profiles.onboardingCompleted, true),
      eq(profiles.role, 'teacher'),
      eq(teachingScopes.subjectId, subjectId),
    ));

  const candidates: InternalDirectoryCandidate[] = [];
  for (const row of rows) {
    if (!row.schoolId || !isRecipientRole(row.role)) continue;
    if (candidates.some((candidate) => candidate.userId === row.userId)) continue;
    candidates.push({
      userId: row.userId,
      name: row.name,
      email: row.email,
      role: row.role,
      schoolId: row.schoolId,
      subjectId: row.subjectId,
      subjectName: subject.name,
    });
  }

  return { subject, candidates };
}

export async function getQuestionRecipients(
  actor: EnquiryActorWithEmail,
  subjectId: string,
): Promise<{ scope: 'school' | 'global'; recipients: QuestionRecipient[] }> {
  if (!isRequesterRole(actor.role)) {
    throw new ApiError(403, 'ROLE_NOT_ALLOWED', 'Only students can choose a recipient.');
  }

  const { candidates } = await loadDirectoryCandidates(subjectId);
  return selectQuestionRecipients(candidates, actor.schoolId);
}

function visibleThreadFilter(actor: EnquiryActorWithEmail) {
  return isRequesterRole(actor.role)
    ? and(
        eq(enquiryThreads.requesterUserId, actor.userId),
        eq(enquiryThreads.isDemo, false),
      )
    : eq(enquiryThreads.recipientUserId, actor.userId);
}

async function loadVisibleThreadRecords(actor: EnquiryActorWithEmail): Promise<ThreadRecord[]> {
  return db.select(threadSelection)
    .from(enquiryThreads)
    .where(visibleThreadFilter(actor))
    .orderBy(desc(enquiryThreads.updatedAt), desc(enquiryThreads.id));
}

async function loadMessageRecords(threadIds: readonly string[]): Promise<MessageRecord[]> {
  if (threadIds.length === 0) return [];
  return db.select(messageSelection)
    .from(enquiryMessages)
    .where(inArray(enquiryMessages.threadId, [...threadIds]))
    .orderBy(asc(enquiryMessages.createdAt), asc(enquiryMessages.id));
}

export async function listEnquiries(
  actor: EnquiryActorWithEmail,
): Promise<EnquiryThreadResponse[]> {
  const threads = await loadVisibleThreadRecords(actor);
  const messages = await loadMessageRecords(threads.map((thread) => thread.id));
  const messagesByThread = new Map<string, MessageRecord[]>();

  for (const message of messages) {
    const list = messagesByThread.get(message.threadId) ?? [];
    list.push(message);
    messagesByThread.set(message.threadId, list);
  }

  return threads.map((thread) => serializeThread(
    thread,
    messagesByThread.get(thread.id) ?? [],
    actor,
  ));
}

async function loadAuthorizedThread(
  actor: EnquiryActorWithEmail,
  threadId: string,
): Promise<ThreadRecord> {
  const [thread] = await db.select(threadSelection)
    .from(enquiryThreads)
    .where(eq(enquiryThreads.id, threadId))
    .limit(1);

  if (!thread || !canAccessThread(actor, thread)) {
    throw new ApiError(404, 'ENQUIRY_NOT_FOUND', 'Enquiry was not found.');
  }
  return thread;
}

async function loadThreadResponse(
  actor: EnquiryActorWithEmail,
  threadId: string,
): Promise<EnquiryThreadResponse> {
  const thread = await loadAuthorizedThread(actor, threadId);
  const messages = await loadMessageRecords([thread.id]);
  return serializeThread(thread, messages, actor);
}

async function findCreateReplayThreadId(
  actorUserId: string,
  submissionId: string,
): Promise<string | null> {
  const [prior] = await db.select({
    messageId: enquiryMessages.id,
    threadId: enquiryMessages.threadId,
    senderUserId: enquiryMessages.senderUserId,
    requesterUserId: enquiryThreads.requesterUserId,
    isDemo: enquiryThreads.isDemo,
  })
    .from(enquiryMessages)
    .innerJoin(enquiryThreads, eq(enquiryMessages.threadId, enquiryThreads.id))
    .where(eq(enquiryMessages.submissionId, submissionId))
    .limit(1);

  if (!prior) return null;

  const [firstMessage] = await db.select({ id: enquiryMessages.id })
    .from(enquiryMessages)
    .where(eq(enquiryMessages.threadId, prior.threadId))
    .orderBy(asc(enquiryMessages.createdAt), asc(enquiryMessages.id))
    .limit(1);

  if (!isCreateSubmissionReplay(actorUserId, prior, firstMessage?.id)) {
    throw new ApiError(409, 'SUBMISSION_ID_CONFLICT', 'Submission ID has already been used.');
  }
  return prior.threadId;
}

export async function createEnquiry(
  actor: EnquiryActorWithEmail,
  input: CreateEnquiryRequest,
): Promise<{ thread: EnquiryThreadResponse; idempotentReplay: boolean }> {
  if (!isRequesterRole(actor.role)) {
    throw new ApiError(403, 'ROLE_NOT_ALLOWED', 'Only students can create an enquiry.');
  }
  const requesterRole = actor.role;

  const replayThreadId = await findCreateReplayThreadId(actor.userId, input.submissionId);
  if (replayThreadId) {
    return {
      thread: await loadThreadResponse(actor, replayThreadId),
      idempotentReplay: true,
    };
  }

  const { subject, candidates } = await loadDirectoryCandidates(input.subjectId);
  const directory = selectQuestionRecipients(candidates, actor.schoolId);
  const selectedPublicRecipient = directory.recipients.find(
    (recipient) => recipient.id === input.recipientUserId,
  );
  const selectedRecipient = selectedPublicRecipient
    ? candidates.find((candidate) => candidate.userId === selectedPublicRecipient.id)
    : undefined;

  if (!selectedRecipient) {
    throw new ApiError(
      400,
      'RECIPIENT_UNAVAILABLE',
      'Select an available teacher for this subject.',
    );
  }

  const [topic] = input.topicId
    ? await db.select({ id: topics.id, name: topics.name })
      .from(topics)
      .where(and(eq(topics.id, input.topicId), eq(topics.subjectId, subject.id)))
      .limit(1)
    : [undefined];

  if (input.topicId && !topic) {
    throw new ApiError(400, 'INVALID_TOPIC', 'The topic does not belong to the selected subject.');
  }

  const transactionResult = await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${input.submissionId}))`,
    );

    const [prior] = await transaction.select({
      messageId: enquiryMessages.id,
      threadId: enquiryMessages.threadId,
      senderUserId: enquiryMessages.senderUserId,
      requesterUserId: enquiryThreads.requesterUserId,
      isDemo: enquiryThreads.isDemo,
    })
      .from(enquiryMessages)
      .innerJoin(enquiryThreads, eq(enquiryMessages.threadId, enquiryThreads.id))
      .where(eq(enquiryMessages.submissionId, input.submissionId))
      .limit(1);

    if (prior) {
      const [firstMessage] = await transaction.select({ id: enquiryMessages.id })
        .from(enquiryMessages)
        .where(eq(enquiryMessages.threadId, prior.threadId))
        .orderBy(asc(enquiryMessages.createdAt), asc(enquiryMessages.id))
        .limit(1);
      if (!isCreateSubmissionReplay(actor.userId, prior, firstMessage?.id)) {
        throw new ApiError(409, 'SUBMISSION_ID_CONFLICT', 'Submission ID has already been used.');
      }
      return { threadId: prior.threadId, idempotentReplay: true };
    }

    const now = new Date();
    const [createdThread] = await transaction.insert(enquiryThreads).values({
      id: randomUUID(),
      requesterUserId: actor.userId,
      recipientUserId: selectedRecipient.userId,
      requesterRole,
      recipientRole: selectedRecipient.role,
      requesterDisplayName: actor.name,
      requesterClassSnapshot: null,
      requesterEmailSnapshot: actor.email,
      recipientDisplayName: selectedRecipient.name,
      recipientEmailSnapshot: selectedRecipient.email,
      subjectId: subject.id,
      topicId: topic?.id ?? null,
      subjectNameSnapshot: subject.name,
      topicNameSnapshot: topic?.name ?? null,
      title: makeEnquiryTitle(input.body),
      isDemo: false,
      demoKey: null,
      createdAt: now,
      updatedAt: now,
    }).returning({ id: enquiryThreads.id });

    if (!createdThread) throw new Error('Enquiry thread insert returned no row.');

    const initialMessageId = randomUUID();
    await transaction.insert(enquiryMessages).values({
      id: initialMessageId,
      threadId: createdThread.id,
      senderUserId: actor.userId,
      senderRole: requesterRole,
      senderDisplayName: actor.name,
      senderEmailSnapshot: actor.email,
      body: input.body,
      submissionId: input.submissionId,
      unread: true,
      readAt: null,
      createdAt: now,
      updatedAt: now,
    });

    await transaction.insert(notifications).values(buildNotificationValues({
      recipientUserId: selectedRecipient.userId,
      actorUserId: actor.userId,
      channel: 'teacher',
      type: 'teacher_enquiry',
      title: `${actor.name} asked a question`,
      body: input.body,
      href: `/ask-teacher?threadId=${createdThread.id}`,
      resourceId: createdThread.id,
      dedupeKey: `teacher-enquiry:${initialMessageId}`,
      createdAt: now,
    })).onConflictDoNothing();

    return { threadId: createdThread.id, idempotentReplay: false };
  });

  return {
    thread: await loadThreadResponse(actor, transactionResult.threadId),
    idempotentReplay: transactionResult.idempotentReplay,
  };
}

export async function sendEnquiryMessage(
  actor: EnquiryActorWithEmail,
  threadId: string,
  input: SendEnquiryMessageRequest,
): Promise<{ message: EnquiryMessageResponse; idempotentReplay: boolean }> {
  const visibleThread = await loadAuthorizedThread(actor, threadId);

  const result = await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${input.submissionId}))`,
    );

    const [prior] = await transaction.select(messageSelection)
      .from(enquiryMessages)
      .where(eq(enquiryMessages.submissionId, input.submissionId))
      .limit(1);

    if (prior) {
      const [thread] = await transaction.select({
        requesterUserId: enquiryThreads.requesterUserId,
        isDemo: enquiryThreads.isDemo,
      }).from(enquiryThreads)
        .where(eq(enquiryThreads.id, prior.threadId))
        .limit(1);
      const [firstMessage] = await transaction.select({ id: enquiryMessages.id })
        .from(enquiryMessages)
        .where(eq(enquiryMessages.threadId, prior.threadId))
        .orderBy(asc(enquiryMessages.createdAt), asc(enquiryMessages.id))
        .limit(1);
      if (!thread || !isReplySubmissionReplay(actor.userId, threadId, {
        ...prior,
        messageId: prior.id,
        requesterUserId: thread.requesterUserId,
        isDemo: thread.isDemo,
      }, firstMessage?.id)) {
        throw new ApiError(409, 'SUBMISSION_ID_CONFLICT', 'Submission ID has already been used.');
      }
      return { message: prior, idempotentReplay: true };
    }

    const now = new Date();
    const [message] = await transaction.insert(enquiryMessages).values({
      id: randomUUID(),
      threadId,
      senderUserId: actor.userId,
      senderRole: actor.role,
      senderDisplayName: actor.name,
      senderEmailSnapshot: actor.email,
      body: input.body,
      submissionId: input.submissionId,
      unread: true,
      readAt: null,
      createdAt: now,
      updatedAt: now,
    }).returning(messageSelection);

    if (!message) throw new Error('Enquiry message insert returned no row.');

    await transaction.update(enquiryThreads)
      .set({ updatedAt: now })
      .where(eq(enquiryThreads.id, threadId));

    const recipientUserId = actor.userId === visibleThread.requesterUserId
      ? visibleThread.recipientUserId
      : visibleThread.requesterUserId;
    if (recipientUserId) {
      await transaction.insert(notifications).values(buildNotificationValues({
        recipientUserId,
        actorUserId: actor.userId,
        channel: 'teacher',
        type: actor.role === 'teacher' ? 'teacher_reply' : 'teacher_enquiry',
        title: actor.role === 'teacher'
          ? `${actor.name} replied to your question`
          : `${actor.name} sent another message`,
        body: input.body,
        href: `/ask-teacher?threadId=${threadId}`,
        resourceId: threadId,
        dedupeKey: `teacher-message:${message.id}`,
        createdAt: now,
      })).onConflictDoNothing();
    }

    return { message, idempotentReplay: false };
  });

  return {
    message: serializeMessage(result.message, actor),
    idempotentReplay: result.idempotentReplay,
  };
}

export async function markEnquiryRead(
  actor: EnquiryActorWithEmail,
  threadId: string,
): Promise<{ threadId: string; readAt: string }> {
  await loadAuthorizedThread(actor, threadId);
  const now = new Date();
  const incomingRoles = isRequesterRole(actor.role)
    ? ['teacher'] as const
    : ['student'] as const;

  await db.update(enquiryMessages).set({
    unread: false,
    readAt: now,
    updatedAt: now,
  }).where(and(
    eq(enquiryMessages.threadId, threadId),
    eq(enquiryMessages.unread, true),
    inArray(enquiryMessages.senderRole, [...incomingRoles]),
  ));

  return { threadId, readAt: now.toISOString() };
}
