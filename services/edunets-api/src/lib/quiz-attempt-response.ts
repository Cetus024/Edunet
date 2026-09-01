export type QuizAttemptAnswerGrading = {
  questionKey: string;
  questionIndex: number;
  isCorrect: boolean;
};

export type QuizAttemptResult = {
  id: string;
  submissionId: string;
  topicId: string;
  mode: 'concept-check';
  correctAnswers: number;
  totalQuestions: number;
  percentCorrect: number;
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
    submittedAt: result.submittedAt,
    idempotentReplay: result.idempotentReplay,
    answers: result.answers,
  };
}
