import { describe, expect, it } from 'vitest';

import { summarizeClassTopic } from '../src/lib/class-concept-web.js';

describe('class concept web averages', () => {
  it('uses the full class size as the score denominator', () => {
    const result = summarizeClassTopic(4, [
      {
        memoryScore: 80,
        lastReviewedAt: new Date('2026-08-01T08:00:00.000Z'),
        nextReviewAt: new Date('2026-08-10T08:00:00.000Z'),
        quizAttempts: 2,
      },
      {
        memoryScore: 60,
        lastReviewedAt: new Date('2026-08-03T08:00:00.000Z'),
        nextReviewAt: new Date('2026-08-08T08:00:00.000Z'),
        quizAttempts: 1,
      },
    ]);

    expect(result).toEqual({
      memoryScore: 35,
      participatingStudents: 2,
      lastReviewedAt: new Date('2026-08-03T08:00:00.000Z'),
      nextReviewAt: new Date('2026-08-08T08:00:00.000Z'),
      quizAttempts: 3,
    });
  });

  it('keeps a topic unstarted when the class has no progress for it', () => {
    expect(summarizeClassTopic(4, [])).toEqual({
      memoryScore: null,
      participatingStudents: 0,
      lastReviewedAt: null,
      nextReviewAt: null,
      quizAttempts: 0,
    });
  });
});
