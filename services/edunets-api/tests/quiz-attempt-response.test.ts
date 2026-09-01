import { describe, expect, it } from 'vitest';
import { buildQuizAttemptResponse } from '../src/lib/quiz-attempt-response.js';

describe('quiz attempt response', () => {
  it('keeps stored grading on an idempotent replay', () => {
    const response = buildQuizAttemptResponse({
      id: 'attempt-1',
      submissionId: 'submission-1',
      topicId: 'bio-ecology',
      mode: 'concept-check',
      correctAnswers: 1,
      totalQuestions: 2,
      percentCorrect: 50,
      submittedAt: new Date('2026-07-31T06:30:00.000Z'),
      idempotentReplay: true,
      answers: [
        { questionKey: 'bio-ecology:v1:q01', questionIndex: 0, isCorrect: true },
        { questionKey: 'bio-ecology:v1:q02', questionIndex: 1, isCorrect: false },
      ],
    });

    expect(response.idempotentReplay).toBe(true);
    expect(response.answers).toEqual([
      { questionKey: 'bio-ecology:v1:q01', questionIndex: 0, isCorrect: true },
      { questionKey: 'bio-ecology:v1:q02', questionIndex: 1, isCorrect: false },
    ]);
  });

  it('does not invent learning progress for concept-only practice', () => {
    const response = buildQuizAttemptResponse({
      id: 'attempt-2', submissionId: 'submission-2', topicId: 'amath-trig', mode: 'concept-check',
      correctAnswers: 5, totalQuestions: 5, percentCorrect: 100,
      submittedAt: new Date('2026-07-31T18:00:00.000Z'), idempotentReplay: false, answers: [],
    });
    expect(response).not.toHaveProperty('nextReviewAt');
    expect(response).not.toHaveProperty('resultingMemoryScore');
  });
});
