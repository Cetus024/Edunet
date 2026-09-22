import { calculateNextReviewAt } from './scoring.js';

export type QuizAttemptAnswerGrading = {
  questionKey: string;
  questionIndex: number;
  isCorrect: boolean;
};

export type QuizAttemptResult = {
  id: string;
  submissionId: string;
  topicId: string;
  mode: 'past-paper' | 'concept-check' | 'speed-round';
  correctAnswers: number;
  totalQuestions: number;
  percentCorrect: number;
  resultingMemoryScore: number;
  submittedAt: Date;
  idempotentReplay: boolean;
  answers: QuizAttemptAnswerGrading[];
};

export function buildQuizAttemptResponse(result: QuizAttemptResult) {
  return {
    id: result.id,
    submissionId: result.submissionId,
    topicId: result.topicId,
    mode: result.mode,
    correctAnswers: result.correctAnswers,
    totalQuestions: result.totalQuestions,
    percentCorrect: result.percentCorrect,
    resultingMemoryScore: result.resultingMemoryScore,
    submittedAt: result.submittedAt,
    nextReviewAt: calculateNextReviewAt(
      result.resultingMemoryScore,
      result.submittedAt,
    ),
    idempotentReplay: result.idempotentReplay,
    answers: result.answers,
  };
}
