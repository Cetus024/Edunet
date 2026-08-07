import {
  getQuestionsForSelection,
  getQuizQuestionKey,
  isQuizAnswerCorrect,
  type QuizQuestion,
} from '../../../../src/lib/quiz-question-bank.js';

export interface KeyedQuizQuestion extends QuizQuestion {
  questionKey: string;
}

export function stableQuestionKey(topicId: string, oneBasedIndex: number): string {
  return getQuizQuestionKey(topicId, oneBasedIndex);
}

export function gradeQuestion(question: QuizQuestion, answer: string | number): boolean {
  return isQuizAnswerCorrect(question, answer);
}

export function getKeyedQuestions(
  topicId: string,
  subjectName: string,
  topicName: string,
): KeyedQuizQuestion[] | null {
  const questions = getQuestionsForSelection(subjectName, topicName);
  if (!questions) return null;

  return questions.map((question, index) => ({
    ...question,
    questionKey: stableQuestionKey(topicId, index + 1),
  }));
}
