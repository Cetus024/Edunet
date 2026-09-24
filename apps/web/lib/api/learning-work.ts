'use client';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from './client';
import type { LearningWork, WorkInput } from '../learning-work';

export const learningWorkKey = (kind: string, roomId: string, userId: string) => ['learning-work', kind, roomId, userId];
export function useLearningWork(kind: 'rescue' | 'revision', roomId: string, userId: string, enabled: boolean, finished: boolean) {
  return useQuery({
    queryKey: [...learningWorkKey(kind, roomId, userId), finished],
    queryFn: () => apiRequest<{ works: LearningWork[] }>(`/api/v1/me/learning-work/${kind}/${encodeURIComponent(roomId)}`),
    enabled, refetchInterval: finished ? false : 4000, retry: false,
  });
}
export function submitLearningWork(kind: 'rescue' | 'revision', roomId: string, input: WorkInput) {
  return apiRequest<{ work: LearningWork }>(`/api/v1/me/learning-work/${kind}/${encodeURIComponent(roomId)}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
}
