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

export type TeacherConceptWebTopic = {
  id: string;
  name: string;
  memoryScore: number | null;
  participatingStudents: number;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  quizAttempts: number;
};

export type TeacherConceptWebResponse = {
  cohortSize: number;
  audience: { kind: 'school' | 'class'; id: string; label: string };
  subject: { id: string; name: string; icon: string | null };
  topics: TeacherConceptWebTopic[];
};

export type TeacherConceptWebView =
  | { view: 'school'; subjectId: string }
  | { view: 'class'; scopeId: string };

export const teacherStudentsQueryKey = ['teacher-students'] as const;

export function useTeacherStudents({ enabled = true, scopeId }: { enabled?: boolean; scopeId: string | null }) {
  return useQuery({
    queryKey: [...teacherStudentsQueryKey, scopeId ?? 'none'],
    queryFn: () => apiRequest<{ students: TeacherStudent[] }>(
      `/api/v1/me/students?${new URLSearchParams({ scopeId: scopeId! }).toString()}`,
    ),
    enabled: enabled && Boolean(scopeId),
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export const teacherConceptWebQueryKey = ['teacher-concept-web'] as const;

export function useTeacherConceptWeb(view: TeacherConceptWebView | null, enabled = true) {
  return useQuery({
    queryKey: [...teacherConceptWebQueryKey, view],
    queryFn: () => apiRequest<TeacherConceptWebResponse>(
      `/api/v1/me/class-concept-web?${new URLSearchParams(view!).toString()}`,
    ),
    enabled: enabled && view !== null,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function studentConceptWebQueryKey(studentId: string) {
  return ['teacher-student-concept-web', studentId] as const;
}

export function useStudentConceptWeb(studentId: string | null, scopeId: string | null) {
  return useQuery({
    queryKey: [...studentConceptWebQueryKey(studentId ?? 'none'), scopeId ?? 'none'],
    queryFn: () => apiRequest<StudentConceptWebResponse>(
      `/api/v1/me/students/${studentId}/concept-web?${new URLSearchParams({ scopeId: scopeId! }).toString()}`,
    ),
    enabled: Boolean(studentId && scopeId),
    staleTime: 15_000,
  });
}
