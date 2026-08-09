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
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  quizAttempts: number;
};

export type StudentConceptWebResponse = {
  student: { id: string; name: string };
  subject: { id: string; name: string; icon: string | null };
  topics: StudentConceptWebTopic[];
};

export const teacherStudentsQueryKey = ['teacher-students'] as const;

export function useTeacherStudents({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: teacherStudentsQueryKey,
    queryFn: () => apiRequest<{ students: TeacherStudent[] }>('/api/v1/me/students'),
    enabled,
    staleTime: 30_000,
  });
}

export function studentConceptWebQueryKey(studentId: string) {
  return ['teacher-student-concept-web', studentId] as const;
}

export function useStudentConceptWeb(studentId: string | null) {
  return useQuery({
    queryKey: studentConceptWebQueryKey(studentId ?? 'none'),
    queryFn: () => apiRequest<StudentConceptWebResponse>(`/api/v1/me/students/${studentId}/concept-web`),
    enabled: Boolean(studentId),
    staleTime: 15_000,
  });
}
