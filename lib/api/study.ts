'use client';

import { useQuery } from '@tanstack/react-query';

import type { SubjectData } from '@/lib/study-data';
import { apiRequest } from '@/lib/api/client';

export type CatalogSchool = {
  id: string;
  name: string;
};

export type CatalogTopic = {
  id: string;
  subjectId: string;
  name: string;
  aliases: string[];
};

export type CatalogSubject = {
  id: string;
  name: string;
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

export type OnboardingInput = {
  role: 'student' | 'teacher' | 'tutor' | 'parent';
  schoolId: string;
  learningSource: 'material' | 'recording' | 'none';
  material: {
    name: string;
    type: string;
    size: number;
    lastModified: number;
  } | null;
  recording: {
    durationSeconds: number;
    mimeType: string;
  } | null;
  subjectId: string;
  topicId: string;
  familiarity: 'new' | 'some' | 'well';
};

export type OnboardingResponse = {
  alreadyCompleted: boolean;
  onboardingCompleted: true;
  profile: unknown;
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
