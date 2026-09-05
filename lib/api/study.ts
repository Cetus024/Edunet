'use client';

import { useQuery } from '@tanstack/react-query';

import type { SubjectData } from '@/lib/study-data';
import type { ModeCalculation } from '@/lib/api/quiz';
import { apiRequest } from '@/lib/api/client';

export type CatalogSchool = {
  id: string;
  name: string;
};

export type CatalogTopic = {
  id: string;
  subjectId: string;
  syllabusCode: string;
  name: string;
  description: string;
  aliases: string[];
  subtopics: CatalogSubtopic[];
};

export type CatalogSubtopic = {
  id: string;
  topicId: string;
  syllabusCode: string;
  name: string;
  description: string;
};

export type CatalogSubject = {
  id: string;
  name: string;
  syllabusCode: string;
  icon: string;
  topics: CatalogTopic[];
};

export type CatalogResponse = {
  schools: CatalogSchool[];
  subjects: CatalogSubject[];
};

export type StudyStateResponse = {
  subjects: SubjectData[];
};

export type PlacementQuestion = {
  questionKey: string;
  type: 'mcq';
  topic: string;
  subtopic: {
    id: string;
    syllabusCode: string;
    name: string;
  } | null;
  text: string;
  options: string[];
  source?: string;
};

export type PlacementSetResponse = {
  submissionId: string;
  subjectId: string;
  topicId: string;
  questions: PlacementQuestion[];
};

export type PlacementAnswerResult = {
  questionKey: string;
  questionIndex: number;
  submittedAnswer: number;
  isCorrect: boolean;
  correctAnswer: number;
  explanation: string;
};

export type PlacementResult = {
  id: string;
  submissionId: string;
  topicId: string;
  correctAnswers: number;
  totalQuestions: number;
  percentCorrect: number;
  resultingMastery: number;
  masteryScore: number;
  submittedAt: string;
  model: ModeCalculation;
  answers: PlacementAnswerResult[];
};

export type StudentOnboardingInput = {
  role: 'student';
  schoolId: string;
  subjectId: string;
  topicId: string;
  placement: {
    submissionId: string;
    startedAt?: string;
    answers: Array<{ questionKey: string; answer: number }>;
  };
};

export type TeacherOnboardingInput = {
  role: 'teacher';
  schoolId: string;
  teachingScopes: Array<{ subjectId: string; classroomName: string }>;
};

export type OnboardingInput = StudentOnboardingInput | TeacherOnboardingInput;

export type OnboardingResponse = {
  alreadyCompleted: boolean;
  onboardingCompleted: true;
  profile: unknown;
  placementResult: PlacementResult | null;
};

export const catalogQueryKey = ['catalog'] as const;
export const studyStateQueryKey = ['study-state'] as const;

export function studyStateQueryKeyForUser(userId: string) {
  return [...studyStateQueryKey, userId] as const;
}

export function getCatalog() {
  return apiRequest<CatalogResponse>('/api/v1/catalog');
}

export function useCatalog() {
  return useQuery({
    queryKey: catalogQueryKey,
    queryFn: getCatalog,
    staleTime: 30 * 60_000,
  });
}

export function getStudyState() {
  return apiRequest<StudyStateResponse>('/api/v1/me/study-state');
}

export function useStudyState({
  userId,
  enabled = true,
}: {
  userId: string | null;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: userId
      ? studyStateQueryKeyForUser(userId)
      : [...studyStateQueryKey, 'anonymous'] as const,
    queryFn: getStudyState,
    enabled: enabled && Boolean(userId),
    staleTime: 30_000,
  });
}

export function saveOnboarding(input: OnboardingInput) {
  return apiRequest<OnboardingResponse>('/api/v1/me/onboarding', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function generatePlacementSet(input: {
  submissionId: string;
  subjectId: string;
  topicId: string;
}) {
  return apiRequest<PlacementSetResponse>('/api/v1/me/onboarding/placement-set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
