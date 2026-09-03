import { atom } from 'jotai';
import { atomWithStorage } from 'jotai/utils';

// Types
export interface TopicData {
  id: string;
  subjectId: string;
  name: string;
  memoryScore: number | null; // null = not started (grey "Not Started")
  modeScores?: {
    mcq: { mastery: number; masteryScore: number; memory: number; memoryScore: number; lastUpdatedAt: string; elapsedDays: number; mode: 'mcq'; quizAttempts?: number } | null;
    essay: { mastery: number; masteryScore: number; memory: number; memoryScore: number; lastUpdatedAt: string; elapsedDays: number; mode: 'essay'; quizAttempts?: number } | null;
  };
  recommendedMode?: 'mcq' | 'essay' | null;
  reviewNow?: boolean;
  calculatedAt?: string;
  lastReviewedAt: string | null; // ISO date string
  nextReviewAt: string | null; // ISO date string
  quizAttempts: number;
}

export interface SubjectData {
  id: string;
  name: string;
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

// Memory Score is already calculated by the backend at read time.
export function getEffectiveScore(topic: TopicData): number | null {
  return topic.memoryScore;
}

// Review due is supplied by the Phase 1 API. The score/date fallback keeps
// locally seeded preview data aligned with the same 60% reminder rule.
export function isAtRisk(topic: TopicData): boolean {
  const score = getEffectiveScore(topic);
  if (score === null) return false;
  if (typeof topic.reviewNow === 'boolean') return topic.reviewNow;
  return score <= 60 || (topic.nextReviewAt !== null && new Date(topic.nextReviewAt) <= new Date());
}

// Get days until next review
export function getDaysUntilReview(nextReviewAt: string | null): number | null {
  if (!nextReviewAt) return null;
  
  const nextReview = new Date(nextReviewAt);
  const now = new Date();
  const diff = nextReview.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// Initial subjects data - Specific scores for Memory Health display
// Biology: 28% (AT RISK), Chemistry: 35% (AT RISK), History: 41% (AT RISK)
// Physics: 62% (NEEDS REVIEW), English: 78% (ON TRACK)
const createInitialData = (): SubjectData[] => [
  {
    id: 'bio',
    name: 'Biology',
    icon: '🧬',
    topics: [
      // Avg will be ~28% for Biology
      { id: 'bio-cell', subjectId: 'bio', name: 'Cell Division (Mitosis)', memoryScore: 28, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 4 },
      { id: 'bio-nutrition', subjectId: 'bio', name: 'Nutrition', memoryScore: 22, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 3 },
      { id: 'bio-respiration', subjectId: 'bio', name: 'Respiration', memoryScore: 30, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 3 },
      { id: 'bio-transport', subjectId: 'bio', name: 'Transport', memoryScore: 32, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 4 },
      { id: 'bio-reproduction', subjectId: 'bio', name: 'Reproduction', memoryScore: 26, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 2 },
      { id: 'bio-ecology', subjectId: 'bio', name: 'Ecology', memoryScore: 30, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 5 },
      { id: 'bio-genetics', subjectId: 'bio', name: 'Genetics', memoryScore: null, lastReviewedAt: null, nextReviewAt: null, quizAttempts: 0 },
    ],
  },
  {
    id: 'chem',
    name: 'Chemistry',
    icon: '⚗️',
    topics: [
      // Avg will be ~35% for Chemistry
      { id: 'chem-atomic', subjectId: 'chem', name: 'Atomic Structure', memoryScore: 38, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 4 },
      { id: 'chem-bonding', subjectId: 'chem', name: 'Covalent Bonding', memoryScore: 35, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 2 },
      { id: 'chem-stoich', subjectId: 'chem', name: 'Stoichiometry', memoryScore: 30, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 2 },
      { id: 'chem-acids', subjectId: 'chem', name: 'Acids & Bases', memoryScore: 36, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 3 },
      { id: 'chem-redox', subjectId: 'chem', name: 'Redox Reactions', memoryScore: 38, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 3 },
      { id: 'chem-organic', subjectId: 'chem', name: 'Organic Chemistry', memoryScore: null, lastReviewedAt: null, nextReviewAt: null, quizAttempts: 0 },
      { id: 'chem-rate', subjectId: 'chem', name: 'Rate of Reaction', memoryScore: 33, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 4 },
    ],
  },
  {
    id: 'phys',
    name: 'Physics',
    icon: '⚛️',
    topics: [
      // Avg will be ~62% for Physics
      { id: 'phys-kinematics', subjectId: 'phys', name: 'Speed & Acceleration', memoryScore: 62, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 5 },
      { id: 'phys-dynamics', subjectId: 'phys', name: 'Dynamics', memoryScore: 64, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 4 },
      { id: 'phys-energy', subjectId: 'phys', name: 'Energy', memoryScore: 68, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 6 },
      { id: 'phys-waves', subjectId: 'phys', name: 'Waves', memoryScore: 60, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 2 },
      { id: 'phys-electricity', subjectId: 'phys', name: 'Electricity', memoryScore: 64, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 3 },
      { id: 'phys-magnetism', subjectId: 'phys', name: 'Electromagnetism', memoryScore: 58, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 2 },
      { id: 'phys-nuclear', subjectId: 'phys', name: 'Nuclear Physics', memoryScore: null, lastReviewedAt: null, nextReviewAt: null, quizAttempts: 0 },
    ],
  },
  {
    id: 'hist',
    name: 'History',
    icon: '🏛️',
    topics: [
      // Avg will be ~41% for History
      { id: 'hist-ww1', subjectId: 'hist', name: 'World War I', memoryScore: 44, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 3 },
      { id: 'hist-ww2', subjectId: 'hist', name: 'World War II', memoryScore: 48, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 4 },
      { id: 'hist-coldwar', subjectId: 'hist', name: 'The Cold War', memoryScore: 31, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 2 },
      { id: 'hist-sg', subjectId: 'hist', name: 'Singapore History', memoryScore: 50, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 5 },
      { id: 'hist-decolonisation', subjectId: 'hist', name: 'Decolonisation', memoryScore: 32, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 1 },
      { id: 'hist-un', subjectId: 'hist', name: 'United Nations', memoryScore: null, lastReviewedAt: null, nextReviewAt: null, quizAttempts: 0 },
    ],
  },
  {
    id: 'eng',
    name: 'English',
    icon: '📚',
    topics: [
      // Avg will be ~78% for English
      { id: 'eng-comprehension', subjectId: 'eng', name: 'Comprehension', memoryScore: 80, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 5 },
      { id: 'eng-summary', subjectId: 'eng', name: 'Summary Writing', memoryScore: 75, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 4 },
      { id: 'eng-situational', subjectId: 'eng', name: 'Situational Writing', memoryScore: 78, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 4 },
      { id: 'eng-continuous', subjectId: 'eng', name: 'Continuous Writing', memoryScore: 76, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 3 },
      { id: 'eng-editing', subjectId: 'eng', name: 'Editing', memoryScore: 82, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 5 },
      { id: 'eng-visual', subjectId: 'eng', name: 'Visual Text', memoryScore: null, lastReviewedAt: null, nextReviewAt: null, quizAttempts: 0 },
    ],
  },
  {
    id: 'geo',
    name: 'Geography',
    icon: '🌍',
    topics: [
      { id: 'geo-weather', subjectId: 'geo', name: 'Weather & Climate', memoryScore: 68, lastReviewedAt: getDateDaysAgo(1), nextReviewAt: null, quizAttempts: 5 },
      { id: 'geo-tectonics', subjectId: 'geo', name: 'Plate Tectonics', memoryScore: 49, lastReviewedAt: getDateDaysAgo(2), nextReviewAt: null, quizAttempts: 3 },
      { id: 'geo-coasts', subjectId: 'geo', name: 'Coasts', memoryScore: 55, lastReviewedAt: getDateDaysAgo(1), nextReviewAt: null, quizAttempts: 4 },
      { id: 'geo-rivers', subjectId: 'geo', name: 'Rivers', memoryScore: 63, lastReviewedAt: getDateDaysAgo(1), nextReviewAt: null, quizAttempts: 4 },
      { id: 'geo-tourism', subjectId: 'geo', name: 'Tourism', memoryScore: 37, lastReviewedAt: getDateDaysAgo(3), nextReviewAt: null, quizAttempts: 2 },
      { id: 'geo-food', subjectId: 'geo', name: 'Food Resources', memoryScore: null, lastReviewedAt: null, nextReviewAt: null, quizAttempts: 0 },
    ],
  },
  {
    id: 'amath',
    name: 'A-Math',
    icon: '📐',
    topics: [
      { id: 'amath-quadratics', subjectId: 'amath', name: 'Quadratics', memoryScore: 82, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 6 },
      { id: 'amath-polynomials', subjectId: 'amath', name: 'Polynomials', memoryScore: 59, lastReviewedAt: getDateDaysAgo(1), nextReviewAt: null, quizAttempts: 4 },
      { id: 'amath-trig', subjectId: 'amath', name: 'Trigonometry', memoryScore: 43, lastReviewedAt: getDateDaysAgo(2), nextReviewAt: null, quizAttempts: 3 },
      { id: 'amath-diff', subjectId: 'amath', name: 'Differentiation', memoryScore: 67, lastReviewedAt: getDateDaysAgo(1), nextReviewAt: null, quizAttempts: 5 },
      { id: 'amath-integration', subjectId: 'amath', name: 'Integration', memoryScore: 51, lastReviewedAt: getDateDaysAgo(2), nextReviewAt: null, quizAttempts: 4 },
      { id: 'amath-coord', subjectId: 'amath', name: 'Coordinate Geometry', memoryScore: null, lastReviewedAt: null, nextReviewAt: null, quizAttempts: 0 },
    ],
  },
  {
    id: 'emath',
    name: 'E-Math',
    icon: '🔢',
    topics: [
      { id: 'emath-numbers', subjectId: 'emath', name: 'Numbers', memoryScore: 85, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 7 },
      { id: 'emath-algebra', subjectId: 'emath', name: 'Algebra', memoryScore: 62, lastReviewedAt: getDateDaysAgo(1), nextReviewAt: null, quizAttempts: 5 },
      { id: 'emath-geometry', subjectId: 'emath', name: 'Geometry', memoryScore: 48, lastReviewedAt: getDateDaysAgo(2), nextReviewAt: null, quizAttempts: 3 },
      { id: 'emath-statistics', subjectId: 'emath', name: 'Statistics', memoryScore: 73, lastReviewedAt: getDateDaysAgo(0), nextReviewAt: null, quizAttempts: 5 },
      { id: 'emath-probability', subjectId: 'emath', name: 'Probability', memoryScore: 54, lastReviewedAt: getDateDaysAgo(1), nextReviewAt: null, quizAttempts: 4 },
      { id: 'emath-mensuration', subjectId: 'emath', name: 'Mensuration', memoryScore: null, lastReviewedAt: null, nextReviewAt: null, quizAttempts: 0 },
    ],
  },
];

// Helper to get ISO date string for X days ago
function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(14, 0, 0, 0); // Set to 2 PM for consistency
  return date.toISOString();
}

export function createEmptySubjectData(): SubjectData[] {
  return createInitialData().map((subject) => ({
    ...subject,
    topics: subject.topics.map((topic) => ({
      ...topic,
      memoryScore: null,
      lastReviewedAt: null,
      nextReviewAt: null,
      quizAttempts: 0,
    })),
  }));
}

// Jotai atoms for global state
// Authenticated learning state is hydrated from the EduNets API. Keep only an in-memory
// mirror for the existing feature components so one user's data can never be
// restored for another user from localStorage.
export const subjectsAtom = atom<SubjectData[]>(createEmptySubjectData());

export const rescueNudgeLogsAtom = atomWithStorage<RescueNudgeLog[]>('edunets-rescue-nudge-logs', []);

// Derived atoms
export const allTopicsAtom = atom((get) => {
  const subjects = get(subjectsAtom);
  return subjects.flatMap(s => s.topics);
});

export const atRiskTopicsAtom = atom((get) => {
  const topics = get(allTopicsAtom);
  return topics.filter(isAtRisk);
});

// Priority queue item type
export interface PriorityQueueItem {
  topic: TopicData;
  effectiveScore: number;
  daysUntilReview: number;
  subjectName: string;
  subjectIcon: string;
  priority: number;
}

// Priority queue: sorted by closest review date + lowest scores first
export const priorityQueueAtom = atom((get) => {
  const topics = get(allTopicsAtom);
  const subjects = get(subjectsAtom);
  
  // The review queue contains only concepts whose saved reminder is due.
  const startedTopics = topics.filter(isAtRisk);
  
  // Calculate priority score for each topic
  const withPriority: PriorityQueueItem[] = startedTopics.map(topic => {
    const effectiveScore = getEffectiveScore(topic) ?? 0;
    const daysUntilReview = getDaysUntilReview(topic.nextReviewAt) ?? 999;
    const subject = subjects.find(s => s.id === topic.subjectId);
    
    // Priority formula: lower daysUntilReview and lower score = higher priority (lower value)
    // Days until review is weighted heavily, but score breaks ties
    const priority = (daysUntilReview * 100) + (100 - effectiveScore);
    
    return {
      topic,
      effectiveScore,
      daysUntilReview,
      subjectName: subject?.name ?? '',
      subjectIcon: subject?.icon ?? '',
      priority,
    };
  });
  
  // Sort by priority (ascending = highest priority first)
  return withPriority.sort((a, b) => a.priority - b.priority);
});

// Subject summary type
export interface SubjectSummary extends SubjectData {
  avgScore: number | null;
  lastReviewed: number | null;
  atRiskCount: number;
  notStartedCount: number;
}

// Subject summaries with average scores
export const subjectSummariesAtom = atom((get) => {
  const subjects = get(subjectsAtom);
  
  return subjects.map((subject): SubjectSummary => {
    const startedTopics = subject.topics.filter(t => t.memoryScore !== null);
    const scores = startedTopics.map(t => getEffectiveScore(t) ?? 0);
    const avgScore = scores.length > 0 
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;
    
    // Find most recent review date
    const reviewDates = startedTopics
      .filter(t => t.lastReviewedAt)
      .map(t => new Date(t.lastReviewedAt!).getTime());
    const lastReviewed = reviewDates.length > 0
      ? Math.floor((Date.now() - Math.max(...reviewDates)) / (1000 * 60 * 60 * 24))
      : null;
    
    return {
      ...subject,
      avgScore,
      lastReviewed,
      atRiskCount: subject.topics.filter(isAtRisk).length,
      notStartedCount: subject.topics.filter(t => t.memoryScore === null).length,
    };
  });
});

// Estimate time to complete review (in minutes)
export function estimateReviewTime(effectiveScore: number): number {
  if (effectiveScore >= 70) return 5;
  if (effectiveScore >= 50) return 8;
  if (effectiveScore >= 30) return 10;
  return 12;
}
