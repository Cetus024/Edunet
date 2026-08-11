import { apiRequest } from '@/lib/api/client';

export type QuizSubmissionMode = 'past-paper' | 'concept-check' | 'speed-round';

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

export function submitQuizAttempt(input: SubmitQuizAttemptInput) {
  return apiRequest<QuizAttemptResult>('/api/v1/me/quiz-attempts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
