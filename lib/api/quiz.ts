import { apiRequest } from '@/lib/api/client';

export type QuizSubmissionMode = 'concept-check' | 'speed-round';
export type QuizQuestionType = 'mcq' | 'fill-blank' | 'structured' | 'diagram';

export type QuizQuestion = {
  questionKey: string;
  type: QuizQuestionType;
  topic: string;
  text: string;
  source?: string;
  resourceNumber?: string;
  options?: string[];
  correctAnswer?: string | number;
  explanation?: string;
  linkedConcept?: string;
  diagramUrl?: string;
  blankWord?: string;
  wordLimit?: number;
};

export type BktParameters = {
  initialMastery: number;
  transition: number;
  slip: number;
  guess: number;
  initialStabilityDays: number;
  stabilityGrowth: number;
  retentionTarget: number;
  successThreshold: number;
};

export type FormulaTraceStep = {
  step: 'prior' | 'bayesian_update' | 'learning_transition' | 'prediction';
  label: string;
  symbolic: string;
  substitution: string;
  calculation: string;
  inputs: Record<string, number | boolean>;
  numerator?: number;
  denominator?: number;
  value: number;
  percentageValue: number;
};

export type DetailedFormula = {
  label: string;
  symbolic: string;
  substitution: string;
  calculation: string;
  value: number | null;
  unit: 'probability' | 'percent' | 'days';
};

export type ReviewProjection = {
  mastery: number;
  masteryScore: number;
  stabilityDays: number;
  successfulReviewsBefore: number;
  successfulReviewsAfter: number;
  successful: boolean;
  reviewNow: boolean;
  nextReviewAt: string | null;
  nextReviewInDays: number | null;
  memoryNow: number;
  memoryIn6Hours: number;
  memoryIn1Day: number;
  trace: {
    mastery: DetailedFormula;
    stability: DetailedFormula;
    memory: DetailedFormula & { deltaDays: number };
    memoryIn6Hours: DetailedFormula & { deltaDays: number };
    memoryIn1Day: DetailedFormula & { deltaDays: number };
    nextReview: DetailedFormula & { valueDays: number | null };
  };
};

export type QuestionUpdateTrace = {
  version: 'bkt-v1';
  parameters: BktParameters;
  isCorrect: boolean;
  priorMastery: number;
  posteriorMastery: number;
  learningGain: number;
  currentMastery: number;
  masteryScore: number;
  predictedCorrectness: number;
  trace: FormulaTraceStep[];
};

export type QuestionModelTrace = QuestionUpdateTrace & {
  priorSource: 'initial_model' | 'stored_mastery' | 'previous_question';
  projection: ReviewProjection;
  projectionIsProvisional: true;
};

export type SpeedSessionAnswer = {
  questionKey: string;
  questionIndex: number;
  submittedAnswer: number;
  isCorrect: boolean;
  correctAnswer: number;
  explanation: string;
  linkedConcept: string;
  answeredAt: string;
  model: QuestionModelTrace;
};

export type SpeedSessionResponse = {
  submissionId: string;
  subjectId: string;
  topicId: string;
  mode: 'speed-round';
  status: 'in_progress' | 'completed' | 'abandoned';
  resumed: boolean;
  questions: QuizQuestion[];
  model: {
    version: 'bkt-v1';
    parameters: BktParameters;
    initialMastery: number;
    currentMastery: number;
    predictedCorrectness: number | null;
    stabilityBefore: number;
    successfulReviewsBefore: number;
    currentProjection: ReviewProjection;
    startingBranches: {
      correct: QuestionUpdateTrace;
      wrong: QuestionUpdateTrace;
    };
  };
  session: {
    answered: number;
    total: number;
    correct: number;
    rawAccuracy: number;
    timeline: Array<{ label: string; questionIndex: number; isCorrect: boolean | null; mastery: number }>;
  };
  answers: SpeedSessionAnswer[];
};

export type SpeedAnswerResponse = SpeedSessionResponse & {
  answer: SpeedSessionAnswer;
  idempotentReplay: boolean;
};

export type SpeedFinishResponse = SpeedSessionResponse & {
  idempotentReplay: boolean;
  result: ReviewProjection & {
    correctAnswers: number;
    totalQuestions: number;
    percentCorrect: number;
  };
};

export type QuizOptionsResponse = {
  subjectId: string;
  topicId: string;
  modes: {
    conceptCheck: { available: boolean; questionCount: number };
    speedRound: { available: boolean; questionCount: number };
  };
};

export type ConceptQuizSetResponse = {
  submissionId: string;
  subjectId: string;
  topicId: string;
  mode: 'concept-check';
  questions: QuizQuestion[];
};

export type QuizSetResponse = ConceptQuizSetResponse | SpeedSessionResponse;
export type QuizSubmissionAnswer = { questionKey: string; answer: string | number };

export type QuizAttemptResult = {
  id: string;
  submissionId: string;
  topicId: string;
  mode: 'concept-check';
  correctAnswers: number;
  totalQuestions: number;
  percentCorrect: number;
  submittedAt: string;
  idempotentReplay: boolean;
  answers: Array<{ questionKey: string; questionIndex: number; isCorrect: boolean }>;
};

export function getQuizOptions(subjectId: string, topicId: string) {
  const query = new URLSearchParams({ subjectId, topicId });
  return apiRequest<QuizOptionsResponse>(`/api/v1/me/quiz-options?${query.toString()}`);
}

export function generateQuizSet(input: { submissionId: string; topicId: string; mode: QuizSubmissionMode }) {
  return apiRequest<QuizSetResponse>('/api/v1/me/quiz-sets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function submitQuizAttempt(input: {
  submissionId: string;
  topicId: string;
  mode: 'concept-check';
  startedAt: string;
  answers: QuizSubmissionAnswer[];
}) {
  return apiRequest<QuizAttemptResult>('/api/v1/me/quiz-attempts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function submitSpeedAnswer(submissionId: string, input: {
  questionKey: string;
  questionIndex: number;
  answer: number;
}) {
  return apiRequest<SpeedAnswerResponse>(`/api/v1/me/quiz-attempts/${encodeURIComponent(submissionId)}/answers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function finishSpeedQuiz(submissionId: string) {
  return apiRequest<SpeedFinishResponse>(`/api/v1/me/quiz-attempts/${encodeURIComponent(submissionId)}/finish`, { method: 'POST' });
}

export function abandonSpeedQuiz(submissionId: string) {
  return apiRequest<{ ok: true }>(`/api/v1/me/quiz-attempts/${encodeURIComponent(submissionId)}/abandon`, { method: 'POST' });
}
