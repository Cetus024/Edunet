import { apiRequest } from '@/lib/api/client';

export type AssessmentMode = 'mcq' | 'essay';

export type Phase1Parameters = {
  initialMastery: number;
  transition: number;
  mcqSlip: number;
  mcqGuess: number;
  mcqEvidenceStrength: number;
  essaySlip: number;
  essayGuess: number;
  stabilityDays: number;
  memoryThreshold: number;
  maximumReminderDays: number;
};

export type FormulaSymbol = {
  symbol: string;
  meaning: string;
  value?: number;
  unit?: 'probability' | 'percent' | 'days' | 'count' | 'marks';
};

export type FormulaTraceStep = {
  step: 'prior_decay' | 'likelihood_known' | 'likelihood_unknown' | 'bayesian_update' | 'learning_transition';
  label: string;
  symbolic: string;
  substitution: string;
  calculation: string;
  explanation: string;
  symbols: FormulaSymbol[];
  value: number;
  percentageValue?: number;
};

export type ModeCalculation = {
  version: 'phase1-v1';
  parameters: Phase1Parameters;
  mode: AssessmentMode;
  previousMastery: number;
  elapsedDays: number;
  priorMastery: number;
  observationScore: number;
  evidenceKnown: number;
  evidenceUnknown: number;
  posteriorMastery: number;
  transitionUsed: number;
  learningGain: number;
  currentMastery: number;
  masteryScore: number;
  trace: FormulaTraceStep[];
  mcq?: { correct: number; wrong: number; total: number };
  essay?: { marksObtained: number; maximumMarks: number };
};

export type ModeMemory = {
  mode: AssessmentMode;
  mastery: number;
  lastUpdatedAt: string;
  quizAttempts?: number;
  elapsedDays: number;
  memory: number;
  memoryScore: number;
  masteryScore: number;
};

export type ConceptMemory = {
  calculatedAt: string;
  modes: { mcq: ModeMemory | null; essay: ModeMemory | null };
  conceptMemory: number | null;
  conceptMemoryScore: number | null;
  recommendedMode: AssessmentMode | null;
  reviewNow: boolean;
  nextReviewAt: string | null;
  reminderCalculatedAt: string | null;
  reminder: {
    reviewNow: boolean;
    rawDays: number;
    reviewInDays: number;
    nextReviewAt: string;
    conceptMemory: number;
  } | null;
};

export type QuizQuestion = {
  questionKey: string;
  type: 'mcq' | 'structured';
  topic: string;
  text: string;
  options?: string[];
  source?: string;
  resourceNumber?: string;
  maxMarks?: number;
};

export type AssessmentAnswer = {
  questionKey: string;
  questionIndex: number;
  submittedAnswer: string | number;
  isCorrect: boolean | null;
  marksObtained: number | null;
  maximumMarks: number | null;
  answeredAt: string;
  correctAnswer: string | number;
  explanation: string;
  linkedConcept: string;
};

export type AssessmentSessionResponse = {
  submissionId: string;
  subjectId: string;
  topicId: string;
  mode: AssessmentMode;
  status: 'in_progress' | 'completed' | 'abandoned';
  feedbackStatus: 'pending' | 'completed' | 'skipped';
  resumed: boolean;
  questions: QuizQuestion[];
  model: {
    version: 'phase1-v1';
    parameters: Phase1Parameters;
    previousMastery: number;
    priorMastery: number;
    priorElapsedDays: number;
    calculation: ModeCalculation | null;
  };
  session: {
    answered: number;
    total: number;
    correct: number;
    marksObtained: number;
    maximumMarks: number;
  };
  answers: AssessmentAnswer[];
  concept: ConceptMemory;
  idempotentReplay?: boolean;
  answer?: AssessmentAnswer;
};

export type QuizOptionsResponse = {
  subjectId: string;
  topicId: string;
  modes: {
    mcq: { available: boolean; questionCount: number };
    essay: { available: boolean; questionCount: number };
  };
};

export function getQuizOptions(subjectId: string, topicId: string) {
  const query = new URLSearchParams({ subjectId, topicId });
  return apiRequest<QuizOptionsResponse>(`/api/v1/me/quiz-options?${query.toString()}`);
}

export function generateQuizSet(input: { submissionId: string; topicId: string; mode: AssessmentMode }) {
  return apiRequest<AssessmentSessionResponse>('/api/v1/me/quiz-sets', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
}

export function submitAssessmentAnswer(submissionId: string, input: {
  questionKey: string;
  questionIndex: number;
  answer: string | number;
  marksObtained?: number;
}) {
  return apiRequest<AssessmentSessionResponse>(`/api/v1/me/quiz-attempts/${encodeURIComponent(submissionId)}/answers`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  });
}

export function finishAssessment(submissionId: string) {
  return apiRequest<AssessmentSessionResponse>(`/api/v1/me/quiz-attempts/${encodeURIComponent(submissionId)}/finish`, { method: 'POST' });
}

export function completeAssessmentFeedback(submissionId: string) {
  return apiRequest<AssessmentSessionResponse>(`/api/v1/me/quiz-attempts/${encodeURIComponent(submissionId)}/feedback-complete`, { method: 'POST' });
}

export function abandonAssessment(submissionId: string) {
  return apiRequest<{ ok: true }>(`/api/v1/me/quiz-attempts/${encodeURIComponent(submissionId)}/abandon`, { method: 'POST' });
}
