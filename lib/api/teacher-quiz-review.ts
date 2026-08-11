'use client';

import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api/client';

export type ReviewQuestion = {
  questionKey: string;
  questionText: string;
  correctAnswer: string | number;
  aiGeneratedExplanation: string;
  teacherEditedExplanation: string | null;
  reviewedByName: string | null;
  reviewedAt: string | null;
  studentsWrong: number;
};

export type ReviewTopic = {
  topicId: string;
  topicName: string;
  questions: ReviewQuestion[];
};

export type QuizReviewResponse = {
  subject: { id: string; name: string };
  topics: ReviewTopic[];
};

function withScope(path: string, scopeId: string | null) {
  if (!scopeId) return path;
  return `${path}?${new URLSearchParams({ scopeId }).toString()}`;
}

export const teacherQuizReviewQueryKey = ['teacher-quiz-review'] as const;

export function useQuizReview({ enabled = true, scopeId = null }: { enabled?: boolean; scopeId?: string | null } = {}) {
  return useQuery({
    queryKey: [...teacherQuizReviewQueryKey, scopeId ?? 'primary'],
    queryFn: () => apiRequest<QuizReviewResponse>(withScope('/api/v1/me/quiz-review', scopeId)),
    enabled,
    staleTime: 15_000,
  });
}

export function saveQuestionReview(questionKey: string, explanation: string) {
  return apiRequest<{ ok: true }>('/api/v1/me/quiz-review', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ questionKey, explanation }),
  });
}
