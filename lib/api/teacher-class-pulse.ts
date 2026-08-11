'use client';

import { useQuery } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api/client';
import type { StudentConceptWebResponse, TeacherStudent } from '@/lib/api/teacher-students';

export type TopicHealth = {
  topicId: string;
  topicName: string;
  studentsStarted: number;
  studentsBelowMastery: number;
  avgScore: number | null;
  status: 'critical' | 'warning' | 'ok' | 'unstarted';
};

export type ClassPulse = {
  studentCount: number;
  topics: TopicHealth[];
};

const MASTERY_THRESHOLD = 70; // matches tierForScore's existing "Strong" cutoff used elsewhere in the app
const AT_RISK_THRESHOLD = 40; // matches tierForScore's existing "Weak" cutoff

function statusFor(topic: Omit<TopicHealth, 'status'>): TopicHealth['status'] {
  if (topic.studentsStarted === 0) return 'unstarted';
  if (topic.avgScore !== null && topic.avgScore < AT_RISK_THRESHOLD) return 'critical';
  if (topic.avgScore !== null && topic.avgScore < MASTERY_THRESHOLD) return 'warning';
  return 'ok';
}

export const teacherClassPulseQueryKey = ['teacher-class-pulse'] as const;

/**
 * Aggregates real per-student topic mastery (from each roster student's own
 * concept-web scores) into a per-topic health summary for the teacher's
 * subject. There is no dedicated aggregate endpoint for this yet, so it
 * fetches the roster once and then every student's concept-web in parallel
 * and reduces client-side - fine for a classroom-sized roster, but this
 * would want a real server-side aggregate query if the roster ever grows
 * large enough for N+1 requests to matter.
 */
export function useTeacherClassPulse({ enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: teacherClassPulseQueryKey,
    queryFn: async (): Promise<ClassPulse> => {
      const { students } = await apiRequest<{ students: TeacherStudent[] }>('/api/v1/me/students');
      const conceptWebs = await Promise.all(
        students.map((student) => apiRequest<StudentConceptWebResponse>(
          `/api/v1/me/students/${student.id}/concept-web`,
        ).catch(() => null)),
      );

      const byTopic = new Map<string, { topicName: string; scores: number[]; started: number }>();
      conceptWebs.forEach((web) => {
        if (!web) return;
        web.topics.forEach((topic) => {
          const entry = byTopic.get(topic.id) ?? { topicName: topic.name, scores: [], started: 0 };
          if (topic.memoryScore !== null) {
            entry.started += 1;
            entry.scores.push(topic.memoryScore);
          }
          byTopic.set(topic.id, entry);
        });
      });

      const topics: TopicHealth[] = Array.from(byTopic.entries()).map(([topicId, entry]) => {
        const avgScore = entry.scores.length > 0
          ? Math.round(entry.scores.reduce((sum, score) => sum + score, 0) / entry.scores.length)
          : null;
        const base = {
          topicId,
          topicName: entry.topicName,
          studentsStarted: entry.started,
          studentsBelowMastery: entry.scores.filter((score) => score < MASTERY_THRESHOLD).length,
          avgScore,
        };
        return { ...base, status: statusFor(base) };
      });

      return { studentCount: students.length, topics };
    },
    enabled,
    staleTime: 30_000,
  });
}
