import { describe, expect, it } from 'vitest';

import { quizQuestionSeed, topicSeed } from '../../../database/seed-data.js';
import {
  BKT_PARAMETERS,
  calculateDynamicProgress,
  calculateLiveQuestion,
  calculateMemory,
  calculateQuestionUpdate,
  calculateReviewSummary,
  calculateStability,
  foldAnswerSequence,
  formatFormulaNumber,
  restoreLiveQuestionCalculation,
} from '../src/lib/knowledge-model.js';
import {
  formatModelDays,
  formatModelNumber,
  formatModelPercent,
  formatPercentageValue,
} from '../../../lib/knowledge-number-format.js';
import {
  gradeQuestion,
  questionKeyFromDatabaseId,
  selectQuestionRows,
  serializePlacementQuestions,
  serializeSpeedQuestions,
  type QuestionPoolRow,
  type QuizQuestion,
} from '../src/lib/question-bank.js';
import { calculatePercentCorrect } from '../src/lib/scoring.js';

const topicById = new Map(topicSeed.map((topic) => [topic.id, topic]));
const questionRows: QuestionPoolRow[] = quizQuestionSeed.map((question) => {
  const topic = topicById.get(question.topicId)!;
  return { ...question, topicName: topic.name, topicPosition: topic.position };
});

describe('BKT knowledge model', () => {
  it('uses the exact fixed values supplied for the model', () => {
    expect(BKT_PARAMETERS).toEqual({
      initialMastery: 0.35,
      transition: 0.20,
      slip: 0.10,
      guess: 0.20,
      initialStabilityDays: 1.5,
      stabilityGrowth: 0.20,
      retentionTarget: 0.85,
      successThreshold: 0.80,
    });
  });

  it('matches the worked ten-answer sequence', () => {
    const updates = foldAnswerSequence([true, false, true, false, false, true, false, false, true, false]);
    expect(updates[0]!.currentMastery).toBeCloseTo(0.7662921348, 10);
    expect(updates[0]!.predictedCorrectness).toBeCloseTo(0.7364044944, 10);
    expect(updates[9]!.currentMastery).toBeCloseTo(0.3737270926, 10);
  });

  it('returns symbolic formulas, substitutions, numerator and denominator', () => {
    const correct = calculateQuestionUpdate(BKT_PARAMETERS.initialMastery, true);
    const wrong = calculateQuestionUpdate(BKT_PARAMETERS.initialMastery, false);
    expect(correct.trace.map((step) => step.step)).toEqual(['prior', 'bayesian_update', 'learning_transition', 'prediction']);
    expect(correct.trace[1]).toMatchObject({
      symbolic: expect.stringContaining('P(L|C)'),
      substitution: expect.stringContaining('0.35'),
      calculation: expect.stringContaining('/'),
      explanation: expect.any(String),
      symbols: expect.arrayContaining([expect.objectContaining({ symbol: 'C' })]),
      numerator: expect.any(Number),
      denominator: expect.any(Number),
    });
    expect(wrong.trace[1]!.symbolic).toContain('P(L|W)');
    expect(wrong.trace[1]!.symbols).toEqual(expect.arrayContaining([expect.objectContaining({ symbol: 'W' })]));
    expect(wrong.trace[1]!.symbols).not.toEqual(expect.arrayContaining([expect.objectContaining({ symbol: 'C' })]));
  });

  it('returns English explanations and symbol definitions for every formula', () => {
    const live = calculateLiveQuestion(0.35, true, 'initial_model', 0, new Date('2026-09-01T00:00:00.000Z'));
    for (const formula of [
      ...live.trace,
      live.projection.trace.mastery,
      live.projection.trace.stability,
      live.projection.trace.memory,
      live.projection.trace.memoryIn6Hours,
      live.projection.trace.memoryIn1Day,
      live.projection.trace.nextReview,
    ]) {
      expect(formula.explanation.trim().length).toBeGreaterThan(0);
      expect(formula.symbols.length).toBeGreaterThan(0);
      expect(formula.symbols.every((entry) => entry.symbol.trim() && entry.meaning.trim())).toBe(true);
    }
    expect(live.trace[0]!.symbols.map((entry) => entry.symbol)).toEqual(['p', 'P', 'L', 't-1']);
    expect(live.trace[2]!.symbols.map((entry) => entry.symbol)).toEqual(['P(Lt)', 'posterior', 'T']);
    expect(live.trace[3]!.symbols.map((entry) => entry.symbol)).toEqual(['CorrectNext', 'P(Lt)', 'Slip', 'Guess']);
    expect(live.projection.trace.stability.symbols.map((entry) => entry.symbol)).toEqual(['S', 'S0', 'k', 'P(Lt)', 'Guess', 'n']);
    expect(live.projection.trace.memory.symbols.map((entry) => entry.symbol)).toEqual(['Memory(t)', 'Mastery', 'exp', 'Δt', 'Stability']);
    expect(live.projection.trace.nextReview.symbols.map((entry) => entry.symbol)).toEqual(['Mastery', 'successThreshold']);
  });

  it('rebuilds legacy live traces with metadata without changing raw model values', () => {
    const original = calculateLiveQuestion(0.35, true, 'initial_model', 0, new Date('2026-09-01T00:00:00.000Z'));
    const restored = restoreLiveQuestionCalculation(
      { priorMastery: original.priorMastery, isCorrect: original.isCorrect, priorSource: original.priorSource },
      'stored_mastery',
      original.projection.successfulReviewsBefore,
      new Date('2026-09-01T00:00:00.000Z'),
    );
    expect(restored.posteriorMastery).toBe(original.posteriorMastery);
    expect(restored.currentMastery).toBe(original.currentMastery);
    expect(restored.predictedCorrectness).toBe(original.predictedCorrectness);
    expect(restored.trace.every((formula) => formula.explanation && formula.symbols.length > 0)).toBe(true);
  });

  it('formats human-readable model values with at most four decimals', () => {
    expect(formatFormulaNumber(0.350000)).toBe('0.35');
    expect(formatFormulaNumber(0.7662921348)).toBe('0.7663');
    expect(formatFormulaNumber(1.23456)).toBe('1.2346');
    expect(formatModelNumber(0.350000)).toBe('0.35');
    expect(formatModelNumber(0.7662921348)).toBe('0.7663');
    expect(formatModelPercent(0.7662921348)).toBe('76.6292%');
    expect(formatPercentageValue(76.62921348)).toBe('76.6292%');
    expect(formatModelDays(1.50000)).toBe('1.5 days');
    const live = calculateLiveQuestion(0.35, true, 'initial_model', 0, new Date('2026-09-01T00:00:00.000Z'));
    const displayStrings = [
      ...live.trace.flatMap((formula) => [formula.substitution, formula.calculation]),
      ...Object.values(live.projection.trace).flatMap((formula) => [formula.substitution, formula.calculation]),
    ];
    expect(displayStrings.every((value) => !/\.\d{5,}/.test(value))).toBe(true);
  });

  it('returns all five live steps after every Speed answer', () => {
    const live = calculateLiveQuestion(0.35, true, 'initial_model', 0, new Date('2026-09-01T00:00:00.000Z'));
    expect(live.priorSource).toBe('initial_model');
    expect(live.learningGain).toBeGreaterThan(0);
    expect(live.masteryScore).toBeCloseTo(76.62921348, 8);
    expect(live.projection.trace).toEqual(expect.objectContaining({
      mastery: expect.objectContaining({ substitution: expect.stringContaining('0.7663') }),
      stability: expect.objectContaining({ substitution: expect.stringContaining('1.5') }),
      memory: expect.objectContaining({ deltaDays: 0 }),
      memoryIn6Hours: expect.objectContaining({ deltaDays: 0.25 }),
      memoryIn1Day: expect.objectContaining({ deltaDays: 1 }),
      nextReview: expect.objectContaining({ symbolic: expect.stringContaining('Review Now') }),
    }));
  });

  it('uses the inclusive 80% success boundary and increments n before stability', () => {
    const summary = calculateReviewSummary(0.8, 0, new Date('2026-09-01T00:00:00.000Z'));
    expect(summary.successful).toBe(true);
    expect(summary.successfulReviewsAfter).toBe(1);
    expect(summary.stabilityDays).toBe(calculateStability(0.8, 1));
    expect(summary.nextReviewAt).not.toBeNull();
    expect(summary.trace.nextReview.symbols.map((entry) => entry.symbol)).toEqual(['Δt', 'S', 'ln', 'retentionTarget']);
  });

  it('recalculates failed stability without incrementing successful reviews', () => {
    const summary = calculateReviewSummary(0.4, 0, new Date('2026-09-01T00:00:00.000Z'));
    expect(summary.successfulReviewsAfter).toBe(0);
    expect(summary.stabilityDays).toBe(1.5);
    expect(summary.reviewNow).toBe(true);
    expect(summary.nextReviewAt).toBeNull();
  });

  it('calculates memory dynamically and clamps negative elapsed time to zero', () => {
    const reviewedAt = new Date('2026-09-01T00:00:00.000Z');
    expect(calculateMemory(0.8, 2, reviewedAt, reviewedAt)).toBe(0.8);
    expect(calculateMemory(0.8, 2, reviewedAt, new Date('2026-09-01T06:00:00.000Z'))).toBeCloseTo(0.8 * Math.exp(-0.25 / 2));
    expect(calculateMemory(0.8, 2, reviewedAt, new Date('2026-09-02T00:00:00.000Z'))).toBeCloseTo(0.8 * Math.exp(-1 / 2));
    expect(calculateMemory(0.8, 2, reviewedAt, new Date('2026-08-31T00:00:00.000Z'))).toBe(0.8);
    expect(calculateDynamicProgress(0.8, 2, reviewedAt, reviewedAt).memoryScore).toBe(80);
  });
});

describe('quiz scoring and question sets', () => {
  it('uses the existing rounded percentage rule', () => {
    expect(calculatePercentCorrect(4, 5)).toBe(80);
    expect(calculatePercentCorrect(2, 5)).toBe(40);
  });

  it('grades database answers without trusting client scores', () => {
    const mcq: QuizQuestion = {
      questionKey: 'biology-ecology:v1:q01', type: 'mcq', topic: 'Ecology', text: 'Question',
      options: ['A', 'B'], correctAnswer: 0, explanation: 'Explanation', linkedConcept: 'Ecology',
    };
    const structured: QuizQuestion = { ...mcq, type: 'structured', correctAnswer: 'habitat loss' };
    expect(gradeQuestion(mcq, 0)).toBe(true);
    expect(gradeQuestion(mcq, '0')).toBe(false);
    expect(gradeQuestion(structured, 'It causes habitat loss.')).toBe(true);
  });

  it('never exposes placement or Speed answers before submission', () => {
    const question: QuizQuestion = {
      questionKey: 'biology-ecology:v1:q01', type: 'mcq', topic: 'Ecology', text: 'Question',
      options: ['A', 'B'], correctAnswer: 0, explanation: 'Secret', linkedConcept: 'Ecology',
    };
    for (const publicQuestion of [...serializePlacementQuestions([question]), ...serializeSpeedQuestions([question])]) {
      expect(publicQuestion).not.toHaveProperty('correctAnswer');
      expect(publicQuestion).not.toHaveProperty('explanation');
      expect(publicQuestion).not.toHaveProperty('linkedConcept');
    }
  });

  it('selects deterministic 10-question Speed sets from the selected topic only', () => {
    const biologyRows = questionRows.filter((row) => row.topicId.startsWith('biology-'));
    const ecology = topicById.get('biology-ecology')!;
    const concept = selectQuestionRows(biologyRows, ecology.id, ecology.position, 'concept-check', 'concept-attempt')!;
    const speed = selectQuestionRows(biologyRows, ecology.id, ecology.position, 'speed-round', 'speed-attempt')!;
    const repeated = selectQuestionRows(biologyRows, ecology.id, ecology.position, 'speed-round', 'speed-attempt')!;
    const different = selectQuestionRows(biologyRows, ecology.id, ecology.position, 'speed-round', 'another-attempt')!;
    const placement = selectQuestionRows(biologyRows, ecology.id, ecology.position, 'placement', 'placement-attempt')!;
    expect(concept).toHaveLength(5);
    expect(speed).toHaveLength(10);
    expect(speed.every((question) => question.topicId === ecology.id && question.type === 'mcq')).toBe(true);
    expect(speed.map((question) => question.id)).toEqual(repeated.map((question) => question.id));
    expect(speed.map((question) => question.id)).not.toEqual(different.map((question) => question.id));
    expect(placement).toHaveLength(10);
  });

  it('maps all fixture questions to unique stable keys', () => {
    const keys = questionRows.map((question) => questionKeyFromDatabaseId(question.id, question.topicId));
    expect(topicSeed).toHaveLength(51);
    expect(questionRows).toHaveLength(612);
    expect(new Set(keys).size).toBe(612);
  });
});
