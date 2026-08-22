import { apiRequest } from '@/lib/api/client';

export type QuizSubmissionMode = 'past-paper' | 'concept-check' | 'speed-round';
export type QuizQuestionType = 'mcq' | 'fill-blank' | 'structured' | 'diagram';

export type QuizQuestion = {
  questionKey: string;
  type: QuizQuestionType;
  topic: string;
  text: string;
  source?: string;
  resourceNumber?: string;
  options?: string[];
  correctAnswer: string | number;
  explanation: string;
  linkedConcept: string;
  diagramUrl?: string;
  blankWord?: string;
  wordLimit?: number;
};

export type QuizOptionsResponse = {
  subjectId: string;
  topicId: string;
  modes: {
    conceptCheck: { available: boolean; questionCount: number };
    speedRound: { available: boolean; questionCount: number };
    pastPaper: Array<{
      id: 'paper-1' | 'paper-2';
      label: string;
      available: boolean;
      questionCount: number;
    }>;
  };
};

export type QuizSetResponse = {
  submissionId: string;
  subjectId: string;
  topicId: string;
  mode: QuizSubmissionMode;
  paperId?: 'paper-1' | 'paper-2';
  questions: QuizQuestion[];
};

export type QuizSubmissionAnswer = {
  questionKey: string;
  answer: string | number;
};

export type QuizAttemptAnswerResult = {
  questionKey: string;
  questionIndex: number;
  isCorrect: boolean;
};

export type QuizAttemptResult = {
  id: string;
  submissionId: string;
  topicId: string;
  mode: QuizSubmissionMode;
  correctAnswers: number;
  totalQuestions: number;
  percentCorrect: number;
  resultingMemoryScore: number;
  submittedAt: string;
  nextReviewAt: string;
  idempotentReplay: boolean;
  answers: QuizAttemptAnswerResult[];
};

export type SubmitQuizAttemptInput = {
  submissionId: string;
  topicId: string;
  mode: QuizSubmissionMode;
  paperId?: string;
  startedAt: string;
  answers: QuizSubmissionAnswer[];
};

export function getQuizOptions(subjectId: string, topicId: string) {
  const query = new URLSearchParams({ subjectId, topicId });
  return apiRequest<QuizOptionsResponse>(`/api/v1/me/quiz-options?${query.toString()}`);
}

export function generateQuizSet(input: {
  submissionId: string;
  topicId: string;
  mode: QuizSubmissionMode;
  paperId?: 'paper-1' | 'paper-2';
}) {
  return apiRequest<QuizSetResponse>('/api/v1/me/quiz-sets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}

export function submitQuizAttempt(input: SubmitQuizAttemptInput) {
  return apiRequest<QuizAttemptResult>('/api/v1/me/quiz-attempts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
