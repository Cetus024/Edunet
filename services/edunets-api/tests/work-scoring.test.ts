import { describe, expect, it } from 'vitest';

import { getConsistencyScore } from '../../../lib/squad-data.js';
import { scoreWorkAnalysis, type WorkAnalysis } from '../../../lib/learning-work.js';

function analysis(overrides: Partial<WorkAnalysis> = {}): WorkAnalysis {
  return {
    verdict: 'looks_consistent',
    summary: '',
    steps: [],
    conceptConflicts: [],
    limitations: [],
    options: [],
    ...overrides,
  };
}

function steps(...statuses: Array<'consistent' | 'error' | 'uncertain'>) {
  return statuses.map((status, index) => ({ quote: `step ${index}`, status, explanation: '' }));
}

describe('scoreWorkAnalysis', () => {
  it('scores every step consistent as full marks', () => {
    expect(scoreWorkAnalysis(analysis({ steps: steps('consistent', 'consistent') })).score).toBe(100);
  });

  it('gives an uncertain step half credit rather than counting it wrong', () => {
    // The analysis could not verify the step; that is not the same as the
    // student getting it wrong, so it must score above an outright error.
    const uncertain = scoreWorkAnalysis(analysis({ steps: steps('consistent', 'uncertain') })).score;
    const wrong = scoreWorkAnalysis(analysis({ steps: steps('consistent', 'error') })).score;

    expect(uncertain).toBe(75);
    expect(wrong).toBe(50);
  });

  it('caps the score by verdict when the model contradicts its own steps', () => {
    const result = scoreWorkAnalysis(analysis({
      verdict: 'needs_revision',
      steps: steps('consistent', 'consistent'),
    }));

    expect(result.score).toBe(65);
  });

  it('penalises concept conflicts but never below zero', () => {
    const one = scoreWorkAnalysis(analysis({
      steps: steps('consistent', 'consistent'),
      conceptConflicts: [{ quote: 'q', concept: 'c', explanation: '' }],
    }));
    expect(one.score).toBe(92);
    expect(one.conflictPenalty).toBe(8);

    const many = scoreWorkAnalysis(analysis({
      verdict: 'needs_revision',
      steps: steps('error', 'error'),
      conceptConflicts: Array.from({ length: 9 }, () => ({ quote: 'q', concept: 'c', explanation: '' })),
    }));
    expect(many.score).toBe(0);
    // Penalty stays capped no matter how many conflicts the analysis lists.
    expect(many.conflictPenalty).toBe(32);
  });

  it('falls back to the verdict when the analysis listed no steps', () => {
    expect(scoreWorkAnalysis(analysis({ verdict: 'looks_consistent' })).score).toBe(80);
    expect(scoreWorkAnalysis(analysis({ verdict: 'needs_clarification' })).score).toBe(50);
    expect(scoreWorkAnalysis(analysis({ verdict: 'needs_revision' })).score).toBe(30);
  });

  it('reports the step tally the student is shown', () => {
    const result = scoreWorkAnalysis(analysis({ steps: steps('consistent', 'error', 'consistent') }));
    expect(result.consistentSteps).toBe(2);
    expect(result.totalSteps).toBe(3);
  });
});

describe('getConsistencyScore', () => {
  it('scores full marks at the streak and work targets', () => {
    expect(getConsistencyScore({ streak: 30, scribbleCount: 10 })).toBe(100);
  });

  it('does not pay out beyond the targets', () => {
    expect(getConsistencyScore({ streak: 400, scribbleCount: 400 })).toBe(100);
  });

  it('weights the streak above whiteboard volume', () => {
    expect(getConsistencyScore({ streak: 30, scribbleCount: 0 })).toBe(60);
    expect(getConsistencyScore({ streak: 0, scribbleCount: 10 })).toBe(40);
  });

  it('is zero for a member who has done nothing yet', () => {
    expect(getConsistencyScore({ streak: 0, scribbleCount: 0 })).toBe(0);
  });
});
