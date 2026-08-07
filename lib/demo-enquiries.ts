'use client';

import type {
  CreateEnquiryInput,
  CreateEnquiryResponse,
  EnquiriesResponse,
  EnquiryMessage,
  EnquiryThread,
  MarkEnquiryReadResponse,
  QuestionRecipientsResponse,
  SendEnquiryMessageInput,
  SendEnquiryMessageResponse,
} from '@/lib/api/enquiries';
import { getDemoCurrentAccount } from '@/lib/demo-auth';
import { createEmptySubjectData } from '@/lib/study-data';

const STORAGE_KEY = 'edunets-demo-enquiries';
const TEACHER_ID = 'neon-demo-teacher';
const STUDENT_ID = 'neon-demo-student';

const DEFAULT_THREADS: EnquiryThread[] = [
  createThread({
    id: 'demo-enquiry-plate-tectonics',
    requesterId: STUDENT_ID,
    requesterName: 'EduNets Student',
    className: 'Sec 4A',
    subjectId: 'geo',
    subjectName: 'Geography',
    topicId: 'geo-tectonics',
    topicName: 'Plate Tectonics',
    body: 'How do convection currents cause tectonic plates to move?',
    createdAt: '2026-07-31T04:11:00.000Z',
  }),
  createThread({
    id: 'demo-enquiry-tourism',
    requesterId: null,
    requesterName: 'James Lim',
    className: 'Sec 4B',
    subjectId: 'geo',
    subjectName: 'Geography',
    topicId: 'geo-tourism',
    topicName: 'Tourism',
    body: 'How should I structure an answer about the negative impacts of tourism?',
    createdAt: '2026-07-31T01:42:00.000Z',
  }),
  createThread({
    id: 'demo-enquiry-weather',
    requesterId: null,
    requesterName: 'Aisha Rahman',
    className: 'Sec 4C',
    subjectId: 'geo',
    subjectName: 'Geography',
    topicId: 'geo-weather',
    topicName: 'Weather & Climate',
    body: 'What is the difference between relief rain and convectional rain?',
    createdAt: '2026-07-30T08:30:00.000Z',
  }),
];

function createThread({
  id,
  requesterId,
  requesterName,
  className,
  subjectId,
  subjectName,
  topicId,
  topicName,
  body,
  createdAt,
}: {
  id: string;
  requesterId: string | null;
  requesterName: string;
  className: string;
  subjectId: string;
  subjectName: string;
  topicId: string;
  topicName: string;
  body: string;
  createdAt: string;
}): EnquiryThread {
  return {
    id,
    isDemo: true,
    title: topicName,
    subject: { id: subjectId, name: subjectName },
    topic: { id: topicId, name: topicName },
    requester: {
      id: requesterId,
      name: requesterName,
      role: 'student',
      className,
    },
    recipient: {
      id: TEACHER_ID,
      name: 'EduNets Teacher',
      role: 'teacher',
    },
    unreadCount: 1,
    createdAt,
    updatedAt: createdAt,
    messages: [
      {
        id: `${id}-message-1`,
        sender: { id: requesterId, name: requesterName, role: 'student' },
        body,
        createdAt,
        isRead: false,
      },
    ],
  };
}

function cloneDefaults() {
  return structuredClone(DEFAULT_THREADS);
}

function readThreads(): EnquiryThread[] {
  if (typeof window === 'undefined') return cloneDefaults();
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (!stored) return cloneDefaults();
  try {
    return JSON.parse(stored) as EnquiryThread[];
  } catch {
    return cloneDefaults();
  }
}

function writeThreads(threads: EnquiryThread[]) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(threads));
  }
}

function requireAccount() {
  const account = getDemoCurrentAccount();
  if (!account?.profile) throw new Error('Log in to use the demo enquiry workspace.');
  return account;
}

export async function getDemoEnquiries(): Promise<EnquiriesResponse> {
  const account = requireAccount();
  const threads = readThreads();
  const visible = account.profile?.role === 'teacher'
    ? threads.filter((thread) => thread.recipient.id === account.user.id)
    : threads.filter((thread) => thread.requester.id === account.user.id);
  return { threads: visible };
}

export async function getDemoQuestionRecipients(
  subjectId: string,
): Promise<QuestionRecipientsResponse> {
  const subject = createEmptySubjectData().find((candidate) => candidate.id === subjectId);
  return {
    scope: 'global',
    recipients: [{
      id: TEACHER_ID,
      name: 'EduNets Teacher',
      role: 'teacher',
      schoolId: 'school-ahmad-ibrahim-secondary-school',
      subjectId,
      subjectName: subject?.name ?? 'O-Level subject',
    }],
  };
}

export async function createDemoEnquiry(
  input: CreateEnquiryInput,
): Promise<CreateEnquiryResponse> {
  const account = requireAccount();
  const profile = account.profile;
  if (!profile || profile.role === 'teacher' || profile.role === 'tutor') {
    throw new Error('Only learner demo accounts can create enquiries.');
  }

  const subjects = createEmptySubjectData();
  const subject = subjects.find((candidate) => candidate.id === input.subjectId);
  const topic = subject?.topics.find((candidate) => candidate.id === input.topicId);
  const now = new Date().toISOString();
  const id = `demo-enquiry-${input.submissionId}`;
  const threads = readThreads();
  const existing = threads.find((thread) => thread.id === id);
  if (existing) return { thread: existing, idempotentReplay: true };

  const thread = createThread({
    id,
    requesterId: account.user.id,
    requesterName: account.user.name,
    className: 'Sec 4',
    subjectId: input.subjectId,
    subjectName: subject?.name ?? input.subjectId,
    topicId: input.topicId ?? input.subjectId,
    topicName: topic?.name ?? 'General question',
    body: input.body,
    createdAt: now,
  });
  threads.unshift(thread);
  writeThreads(threads);
  return { thread, idempotentReplay: false };
}

export async function sendDemoEnquiryMessage(
  threadId: string,
  input: SendEnquiryMessageInput,
): Promise<SendEnquiryMessageResponse> {
  const account = requireAccount();
  const threads = readThreads();
  const thread = threads.find((candidate) => candidate.id === threadId);
  if (!thread) throw new Error('This demo enquiry could not be found.');

  const messageId = `demo-message-${input.submissionId}`;
  const existing = thread.messages.find((message) => message.id === messageId);
  if (existing) return { message: existing, idempotentReplay: true };

  const createdAt = new Date().toISOString();
  const role = account.profile?.role ?? 'student';
  const message: EnquiryMessage = {
    id: messageId,
    sender: { id: account.user.id, name: account.user.name, role },
    body: input.body,
    createdAt,
    isRead: true,
  };
  thread.messages.push(message);
  thread.updatedAt = createdAt;
  thread.unreadCount = 0;
  writeThreads(threads);
  return { message, idempotentReplay: false };
}

export async function markDemoEnquiryRead(
  threadId: string,
): Promise<MarkEnquiryReadResponse> {
  requireAccount();
  const threads = readThreads();
  const thread = threads.find((candidate) => candidate.id === threadId);
  if (!thread) throw new Error('This demo enquiry could not be found.');
  const readAt = new Date().toISOString();
  thread.unreadCount = 0;
  thread.messages = thread.messages.map((message) => ({ ...message, isRead: true }));
  writeThreads(threads);
  return { threadId, readAt };
}
