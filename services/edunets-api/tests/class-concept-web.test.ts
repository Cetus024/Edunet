import { describe, expect, it } from 'vitest';

import { summarizeClassTopic } from '../src/lib/class-concept-web.js';

describe('class concept web averages', () => {
  it('uses the full class size as the score denominator', () => {
    const result = summarizeClassTopic(4, [
      {
        userId: 'student-1',
        mode: 'mcq',
        mastery: 0.8,
        lastUpdatedAt: new Date('2026-08-03T08:00:00.000Z'),
        quizAttempts: 2,
      },
      {
        userId: 'student-2',
        mode: 'essay',
        mastery: 0.6,
        lastUpdatedAt: new Date('2026-08-03T08:00:00.000Z'),
        quizAttempts: 1,
      },
    ], new Date('2026-08-03T08:00:00.000Z'));

    expect(result).toEqual({
      memoryScore: 35,
      participatingStudents: 2,
      lastReviewedAt: new Date('2026-08-03T08:00:00.000Z'),
      nextReviewAt: null,
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

  it('returns the earliest saved combined reminder for the class topic', () => {
    const result = summarizeClassTopic(1, [{
      userId: 'student-1',
      mode: 'mcq',
      mastery: 0.8,
      lastUpdatedAt: new Date('2026-09-01T00:00:00Z'),
      quizAttempts: 1,
    }], new Date('2026-09-01T00:00:00Z'), [
      new Date('2026-09-04T00:00:00Z'),
      new Date('2026-09-02T00:00:00Z'),
    ]);
    expect(result.nextReviewAt).toEqual(new Date('2026-09-02T00:00:00Z'));
  });
});
