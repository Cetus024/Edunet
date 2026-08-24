'use client';

import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api/client';

export type EnquiryRole = 'student' | 'teacher';

export type QuestionRecipient = {
  id: string;
  name: string;
  role: 'teacher';
  schoolId: string;
  subjectId: string;
  subjectName: string;
};

export type QuestionRecipientsResponse = {
  scope: 'school' | 'global';
  recipients: QuestionRecipient[];
};

export type EnquiryMessage = {
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

export type EnquiryThread = {
  id: string;
  isDemo: boolean;
  title: string;
  subject: {
    id: string;
    name: string;
  };
  topic: {
    id: string;
    name: string;
  } | null;
  requester: {
    id: string | null;
    name: string;
    role: 'student';
    className: string | null;
  };
  recipient: {
    id: string;
    name: string;
    role: 'teacher';
  };
  unreadCount: number;
  createdAt: string;
  updatedAt: string;
  messages: EnquiryMessage[];
};

export type EnquiriesResponse = {
  threads: EnquiryThread[];
};

export type CreateEnquiryInput = {
  submissionId: string;
  recipientUserId: string;
  subjectId: string;
  topicId?: string | null;
  body: string;
};

export type CreateEnquiryResponse = {
  thread: EnquiryThread;
  idempotentReplay: boolean;
};

export type SendEnquiryMessageInput = {
  submissionId: string;
  body: string;
};

export type SendEnquiryMessageResponse = {
  message: EnquiryMessage;
  idempotentReplay: boolean;
};

export type MarkEnquiryReadResponse = {
  threadId: string;
  readAt: string;
};

export const enquiriesQueryKey = ['enquiries'] as const;
export const questionRecipientsQueryKey = ['question-recipients'] as const;

function visiblePollingInterval() {
  if (typeof document === 'undefined') return false;
  return document.visibilityState === 'visible' ? 10_000 : false;
}

export function useEnquiries({
  userId,
  enabled = true,
}: {
  userId: string | null;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: [...enquiriesQueryKey, userId ?? 'anonymous'],
    queryFn: () => apiRequest<EnquiriesResponse>('/api/v1/me/enquiries'),
    enabled: enabled && Boolean(userId),
    staleTime: 5_000,
    refetchInterval: visiblePollingInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function selectTotalUnreadEnquiries(data: EnquiriesResponse | undefined) {
  return data?.threads.reduce((total, thread) => total + thread.unreadCount, 0) ?? 0;
}

/**
 * Uses the same role-scoped query cache as the enquiry workspaces, so consumers
 * such as the sidebar can show a badge without issuing a second API request.
 */
export function useEnquiryUnreadCount({
  userId,
  enabled = true,
}: {
  userId: string | null;
  enabled?: boolean;
}) {
  const query = useEnquiries({ userId, enabled });

  return {
    unreadCount: selectTotalUnreadEnquiries(query.data),
    isPending: query.isPending,
    isError: query.isError,
  };
}

export function useQuestionRecipients({
  userId,
  subjectId,
  enabled = true,
}: {
  userId: string | null;
  subjectId: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: [...questionRecipientsQueryKey, userId ?? 'anonymous', subjectId],
    queryFn: () => apiRequest<QuestionRecipientsResponse>(
      `/api/v1/me/question-recipients?subjectId=${encodeURIComponent(subjectId)}`,
    ),
    enabled: enabled && Boolean(userId && subjectId),
    staleTime: 30_000,
    refetchInterval: visiblePollingInterval,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
}

export function createEnquiry(input: CreateEnquiryInput) {
  return apiRequest<CreateEnquiryResponse>('/api/v1/me/enquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function sendEnquiryMessage(threadId: string, input: SendEnquiryMessageInput) {
  return apiRequest<SendEnquiryMessageResponse>(`/api/v1/me/enquiries/${threadId}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function markEnquiryRead(threadId: string) {
  return apiRequest<MarkEnquiryReadResponse>(`/api/v1/me/enquiries/${threadId}/read`, {
    method: 'PUT',
  });
}
