import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

import { CURRICULUM } from '@/lib/curriculum';

export interface TopicSubtopicData {
  id: string;
  topicId: string;
  syllabusCode: string;
  name: string;
  description: string;
}

export interface TopicData {
  id: string;
  subjectId: string;
  syllabusCode: string;
  name: string;
  description: string;
  subtopics: TopicSubtopicData[];
  memoryScore: number | null;
  modeScores?: {
    mcq: { mastery: number; masteryScore: number; memory: number; memoryScore: number; lastUpdatedAt: string; elapsedDays: number; mode: 'mcq'; quizAttempts?: number } | null;
    essay: { mastery: number; masteryScore: number; memory: number; memoryScore: number; lastUpdatedAt: string; elapsedDays: number; mode: 'essay'; quizAttempts?: number } | null;
  };
  recommendedMode?: 'mcq' | 'essay' | null;
  reviewNow?: boolean;
  calculatedAt?: string;
  lastReviewedAt: string | null;
  nextReviewAt: string | null;
  quizAttempts: number;
}

export interface SubjectData {
  id: string;
  name: string;
  syllabusCode: string;
  icon: string;
  topics: TopicData[];
}

export interface RescueNudgeLog {
  id: string;
  memberId: string;
  memberName: string;
  senderName: string;
  subject: string;
  topic: string;
  message: string;
  pendingRescue: boolean;
  rescueStatus: 'pending' | 'completed' | 'expired';
  createdAt: number;
  roomId?: string;
  resolvedAt?: number;
}

export function getEffectiveScore(topic: TopicData): number | null {
  return topic.memoryScore;
}

export function isAtRisk(topic: TopicData): boolean {
  const score = getEffectiveScore(topic);
  if (score === null) return false;
  if (typeof topic.reviewNow === 'boolean') return topic.reviewNow;
  return score <= 60 || (topic.nextReviewAt !== null && new Date(topic.nextReviewAt) <= new Date());
}

export function getDaysUntilReview(nextReviewAt: string | null): number | null {
  if (!nextReviewAt) return null;
  return Math.ceil((new Date(nextReviewAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function createEmptySubjectData(): SubjectData[] {
  return CURRICULUM.map((subject) => ({
    id: subject.id,
    name: subject.name,
    syllabusCode: subject.syllabusCode,
    icon: subject.icon,
    topics: subject.topics.map((topic) => ({
      id: topic.id,
      subjectId: subject.id,
      syllabusCode: topic.syllabusCode,
      name: topic.name,
      description: topic.description,
      subtopics: topic.subtopics.map((child) => ({ ...child, topicId: topic.id })),
      memoryScore: null,
      lastReviewedAt: null,
      nextReviewAt: null,
      quizAttempts: 0,
    })),
  }));
}

export const subjectsAtom = atom<SubjectData[]>(createEmptySubjectData());
export const rescueNudgeLogsAtom = atomWithStorage<RescueNudgeLog[]>('edunets-rescue-nudge-logs', []);

export const allTopicsAtom = atom((get) => get(subjectsAtom).flatMap((subject) => subject.topics));
export const atRiskTopicsAtom = atom((get) => get(allTopicsAtom).filter(isAtRisk));

export interface PriorityQueueItem {
  topic: TopicData;
  effectiveScore: number;
  daysUntilReview: number;
  subjectName: string;
  subjectIcon: string;
  priority: number;
}

export const priorityQueueAtom = atom((get) => {
  const topics = get(allTopicsAtom);
  const subjects = get(subjectsAtom);
  return topics.filter(isAtRisk).map((topic) => {
    const effectiveScore = getEffectiveScore(topic) ?? 0;
    const daysUntilReview = getDaysUntilReview(topic.nextReviewAt) ?? 999;
    const subject = subjects.find((candidate) => candidate.id === topic.subjectId);
    return {
      topic,
      effectiveScore,
      daysUntilReview,
      subjectName: subject?.name ?? '',
      subjectIcon: subject?.icon ?? '',
      priority: (daysUntilReview * 100) + (100 - effectiveScore),
    };
  }).sort((a, b) => a.priority - b.priority);
});

export interface SubjectSummary extends SubjectData {
  avgScore: number | null;
  lastReviewed: number | null;
  atRiskCount: number;
  notStartedCount: number;
}

export const subjectSummariesAtom = atom((get) => get(subjectsAtom).map((subject): SubjectSummary => {
  const startedTopics = subject.topics.filter((topic) => topic.memoryScore !== null);
  const scores = startedTopics.map((topic) => getEffectiveScore(topic) ?? 0);
  const reviewDates = startedTopics
    .filter((topic) => topic.lastReviewedAt)
    .map((topic) => new Date(topic.lastReviewedAt!).getTime());
  return {
    ...subject,
    avgScore: scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    lastReviewed: reviewDates.length > 0
      ? Math.floor((Date.now() - Math.max(...reviewDates)) / (1000 * 60 * 60 * 24))
      : null,
    atRiskCount: subject.topics.filter(isAtRisk).length,
    notStartedCount: subject.topics.filter((topic) => topic.memoryScore === null).length,
  };
}));

export function estimateReviewTime(effectiveScore: number): number {
  if (effectiveScore >= 70) return 5;
  if (effectiveScore >= 50) return 8;
  if (effectiveScore >= 30) return 10;
  return 12;
}
