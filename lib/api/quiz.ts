import {
  getQuestionsForSelection,
  getQuizQuestionKey,
  isQuizAnswerCorrect,
} from '@/lib/quiz-question-bank';
import {
  calculateNextReviewDate,
  calculateScoreFromQuizResult,
  createEmptySubjectData,
} from '@/lib/study-data';

const DEMO_ATTEMPTS_KEY = 'edunets-demo-quiz-attempts';

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
  startedAt: string;
  answers: QuizSubmissionAnswer[];
};

export function submitQuizAttempt(input: SubmitQuizAttemptInput) {
  const stored = typeof window === 'undefined'
    ? []
    : readDemoAttempts();
  const previous = stored.find((attempt) => attempt.submissionId === input.submissionId);
  if (previous) return Promise.resolve({ ...previous, idempotentReplay: true });

  const subject = createEmptySubjectData().find((candidate) => (
    candidate.topics.some((topic) => topic.id === input.topicId)
  ));
  const topic = subject?.topics.find((candidate) => candidate.id === input.topicId);
  const questions = subject && topic
    ? getQuestionsForSelection(subject.name, topic.name)
    : null;
  if (!questions) return Promise.reject(new Error('No questions are available for this demo topic.'));

  const answerResults = questions.map((question, questionIndex) => {
    const questionKey = getQuizQuestionKey(input.topicId, question.id);
    const submitted = input.answers.find((answer) => answer.questionKey === questionKey);
    return {
      questionKey,
      questionIndex,
      isCorrect: isQuizAnswerCorrect(question, submitted?.answer ?? null),
    };
  });
  const correctAnswers = answerResults.filter((answer) => answer.isCorrect).length;
  const totalQuestions = questions.length;
  const percentCorrect = Math.round((correctAnswers / totalQuestions) * 100);
  const submittedAt = new Date().toISOString();
  const resultingMemoryScore = calculateScoreFromQuizResult(percentCorrect);
  const result: QuizAttemptResult = {
    id: `demo-attempt-${input.submissionId}`,
    submissionId: input.submissionId,
    topicId: input.topicId,
    mode: input.mode,
    correctAnswers,
    totalQuestions,
    percentCorrect,
    resultingMemoryScore,
    submittedAt,
    nextReviewAt: calculateNextReviewDate(resultingMemoryScore).toISOString(),
    idempotentReplay: false,
    answers: answerResults,
  };

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(DEMO_ATTEMPTS_KEY, JSON.stringify([...stored, result]));
  }
  return Promise.resolve(result);
}

function readDemoAttempts(): QuizAttemptResult[] {
  const value = window.localStorage.getItem(DEMO_ATTEMPTS_KEY);
  if (!value) return [];
  try {
    return JSON.parse(value) as QuizAttemptResult[];
  } catch {
    return [];
  }
}
