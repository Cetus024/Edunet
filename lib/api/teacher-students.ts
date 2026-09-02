'use client';

import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api/client';

export type TeacherStudent = {
  id: string;
  name: string;
  email: string;
  topicId: string | null;
  topicName: string | null;
};

export type StudentConceptWebTopic = {
  id: string;
  name: string;
  memoryScore: number | null;
  modeScores: {
    mcq: { mode: 'mcq'; mastery: number; memory: number; memoryScore: number; masteryScore: number; lastUpdatedAt: string; elapsedDays: number; quizAttempts?: number } | null;
    essay: { mode: 'essay'; mastery: number; memory: number; memoryScore: number; masteryScore: number; lastUpdatedAt: string; elapsedDays: number; quizAttempts?: number } | null;
  };
  recommendedMode: 'mcq' | 'essay' | null;
  reviewNow: boolean;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  quizAttempts: number;
};

export type StudentConceptWebResponse = {
  student: { id: string; name: string };
  subject: { id: string; name: string; icon: string | null };
  topics: StudentConceptWebTopic[];
};

export type ClassConceptWebTopic = {
  id: string;
  name: string;
  memoryScore: number | null;
  participatingStudents: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  quizAttempts: number;
};

export type ClassConceptWebResponse = {
  classSize: number;
  subject: { id: string; name: string; icon: string | null };
  topics: ClassConceptWebTopic[];
};

export const teacherStudentsQueryKey = ['teacher-students'] as const;

function withScope(path: string, scopeId: string | null) {
  if (!scopeId) return path;
  return `${path}?${new URLSearchParams({ scopeId }).toString()}`;
}

export function useTeacherStudents({ enabled = true, scopeId = null }: { enabled?: boolean; scopeId?: string | null } = {}) {
  return useQuery({
    queryKey: [...teacherStudentsQueryKey, scopeId ?? 'primary'],
    queryFn: () => apiRequest<{ students: TeacherStudent[] }>(withScope('/api/v1/me/students', scopeId)),
    enabled,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export const classConceptWebQueryKey = ['teacher-class-concept-web'] as const;

export function useClassConceptWeb({ enabled = true, scopeId = null }: { enabled?: boolean; scopeId?: string | null } = {}) {
  return useQuery({
    queryKey: [...classConceptWebQueryKey, scopeId ?? 'primary'],
    queryFn: () => apiRequest<ClassConceptWebResponse>(withScope('/api/v1/me/class-concept-web', scopeId)),
    enabled,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function studentConceptWebQueryKey(studentId: string) {
  return ['teacher-student-concept-web', studentId] as const;
}

export function useStudentConceptWeb(studentId: string | null, scopeId: string | null = null) {
  return useQuery({
    queryKey: [...studentConceptWebQueryKey(studentId ?? 'none'), scopeId ?? 'primary'],
    queryFn: () => apiRequest<StudentConceptWebResponse>(withScope(`/api/v1/me/students/${studentId}/concept-web`, scopeId)),
    enabled: Boolean(studentId),
    staleTime: 15_000,
  });
}

export type StudentSearchResult = {
  id: string;
  name: string;
  email: string;
  schoolId: string;
  subjectId: string | null;
  inClass: boolean;
};

export function studentSearchQueryKey(query: string, scopeId: string) {
  return ['teacher-student-search', scopeId, query] as const;
}

/**
 * Powers the "Add student" search in the teacher dashboard - candidates are
 * students at the teacher's own school, tagged with whether they're already
 * in this class (implicit school+subject match or a prior explicit add) so
 * the picker can grey out a duplicate instead of erroring on it.
 */
export function useSearchStudents(query: string, scopeId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: studentSearchQueryKey(query, scopeId ?? 'none'),
    queryFn: () => apiRequest<{ students: StudentSearchResult[] }>(
      `/api/v1/me/students/search?${new URLSearchParams({ q: query, scopeId: scopeId ?? '' }).toString()}`,
    ),
    enabled: enabled && Boolean(scopeId) && query.trim().length >= 2,
    staleTime: 10_000,
  });
}

export function addStudentToClass(studentId: string, scopeId: string) {
  return apiRequest<{ ok: true }>('/api/v1/me/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ studentId, scopeId }),
  });
}

export function removeStudentFromClass(studentId: string, scopeId: string) {
  return apiRequest<{ ok: true }>(`/api/v1/me/students/${studentId}?${new URLSearchParams({ scopeId }).toString()}`, {
    method: 'DELETE',
  });
}
