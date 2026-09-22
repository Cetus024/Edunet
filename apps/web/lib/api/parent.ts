'use client';

import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api/client';
import type { SubjectData } from '@/lib/study-data';

export type ParentChildResponse = {
  status: 'linked' | 'pending';
  childName: string;
  childEmail: string;
  child: { id: string; name: string; email: string } | null;
  subjects: SubjectData[];
  tutors: Array<{ id: string; name: string; role: 'teacher' | 'tutor'; subjectName: string | null }>;
};

export const childProgressQueryKey = ['parent-child-progress'] as const;

export function useChildProgress({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: childProgressQueryKey,
    queryFn: () => apiRequest<ParentChildResponse>('/api/v1/me/child'),
    enabled,
    staleTime: 15_000,
  });
}
