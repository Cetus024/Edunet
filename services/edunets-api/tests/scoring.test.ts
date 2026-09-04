import { describe, expect, it } from 'vitest';

import { quizQuestionSeed, topicSeed } from '../../../database/seed-data.js';
import {
  PHASE1_PARAMETERS,
  calculateConceptMemory,
  calculateEssayMastery,
  calculateMcqMastery,
  calculateMemory,
  calculateReminder,
  decayMastery,
  formatFormulaNumber,
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
  type QuestionPoolRow,
  type QuizQuestion,
} from '../src/lib/question-bank.js';
import { calculatePercentCorrect } from '../src/lib/scoring.js';

const topicById = new Map(topicSeed.map((topic) => [topic.id, topic]));
const questionRows: QuestionPoolRow[] = quizQuestionSeed.map((question) => {
  const topic = topicById.get(question.topicId)!;
  return { ...question, topicName: topic.name, topicPosition: topic.position };
});

describe('Phase 1 knowledge model', () => {
  it('uses the fixed Phase 1 parameters', () => {
    expect(PHASE1_PARAMETERS).toEqual({
      initialMastery: 0.35,
      transition: 0.20,
      mcqSlip: 0.20,
      mcqGuess: 0.25,
      mcqEvidenceStrength: 0.30,
      essaySlip: 0.15,
      essayGuess: 0.05,
      stabilityDays: 7.83,
      memoryThreshold: 0.60,
      maximumReminderDays: 4,
    });
  });

  it('matches the supplied MCQ 6/10 example before and after corrections', () => {
    const assessment = calculateMcqMastery({ correct: 6, wrong: 4 });
    const corrected = calculateMcqMastery({ correct: 6, wrong: 4, feedbackCompleted: true });

    expect(assessment.posteriorMastery).toBeCloseTo(0.4721601339710801, 12);
    expect(assessment.currentMastery * 100).toBeCloseTo(47.22, 2);
    expect(assessment.transitionUsed).toBe(0);
    expect(corrected.posteriorMastery).toBe(assessment.posteriorMastery);
    expect(corrected.currentMastery * 100).toBeCloseTo(57.77, 2);
    expect(corrected.transitionUsed).toBe(0.20);
  });

  it('matches the supplied Essay 13/20 example before and after corrections', () => {
    const assessment = calculateEssayMastery({ marksObtained: 13, maximumMarks: 20 });
    const corrected = calculateEssayMastery({ marksObtained: 13, maximumMarks: 20, feedbackCompleted: true });

    expect(assessment.observationScore).toBe(0.65);
    expect(assessment.posteriorMastery * 100).toBeCloseTo(64.03, 2);
    expect(corrected.posteriorMastery).toBe(assessment.posteriorMastery);
    expect(corrected.currentMastery * 100).toBeCloseTo(71.22, 2);
  });

  it('is independent of MCQ answer order because it uses batch counts', () => {
    const firstOrder = [true, false, true, false, true, true, false, true, false, true];
    const secondOrder = [...firstOrder].reverse();
    const calculate = (answers: boolean[]) => calculateMcqMastery({
      correct: answers.filter(Boolean).length,
      wrong: answers.filter((answer) => !answer).length,
    });

    expect(calculate(firstOrder)).toMatchObject({
      evidenceKnown: calculate(secondOrder).evidenceKnown,
      evidenceUnknown: calculate(secondOrder).evidenceUnknown,
      posteriorMastery: calculate(secondOrder).posteriorMastery,
    });
  });

  it('decays later priors with fixed S, including a 30-day gap', () => {
    expect(decayMastery(0.8, 0)).toBe(0.8);
    expect(decayMastery(0.8, 30)).toBeCloseTo(0.8 * Math.exp(-30 / 7.83), 12);
    const later = calculateMcqMastery({ previousMastery: 0.8, elapsedDays: 30, correct: 6, wrong: 4 });
    expect(later.priorMastery).toBeCloseTo(decayMastery(0.8, 30), 12);
    expect(calculateMemory(0.8, new Date('2026-08-03T00:00:00Z'), new Date('2026-08-02T00:00:00Z'))).toBe(0.8);
  });

  it('averages mode Memory and recommends the weaker mode with MCQ tie-break', () => {
    const now = new Date('2026-09-01T00:00:00Z');
    const mcqOnly = calculateConceptMemory([{ mode: 'mcq', mastery: 0.7, lastUpdatedAt: now }], now);
    expect(mcqOnly.conceptMemory).toBe(0.7);
    expect(mcqOnly.recommendedMode).toBe('mcq');

    const supplied = calculateConceptMemory([
      { mode: 'mcq', mastery: 0.5777, lastUpdatedAt: now },
      { mode: 'essay', mastery: 0.7123, lastUpdatedAt: now },
    ], now);
    expect(supplied.conceptMemoryScore).toBeCloseTo(64.50, 2);
    expect(supplied.recommendedMode).toBe('mcq');

    const tie = calculateConceptMemory([
      { mode: 'mcq', mastery: 0.7, lastUpdatedAt: now },
      { mode: 'essay', mastery: 0.7, lastUpdatedAt: now },
    ], now);
    expect(tie.recommendedMode).toBe('mcq');
  });

  it('uses the inclusive 60% boundary, ceiling, and four-day reminder cap', () => {
    const now = new Date('2026-09-01T00:00:00Z');
    expect(calculateReminder(0.60, now)).toMatchObject({ reviewNow: true, reviewInDays: 0, nextReviewAt: now });
    expect(calculateReminder(0.645, now)).toMatchObject({ reviewNow: false, reviewInDays: 1 });
    expect(calculateReminder(1, now)).toMatchObject({ reviewNow: false, reviewInDays: 4 });
    expect(calculateReminder(0.645, now).nextReviewAt).toEqual(new Date('2026-09-02T00:00:00Z'));
  });

  it('returns the full trace with four-decimal display substitutions', () => {
    const calculation = calculateMcqMastery({ correct: 6, wrong: 4 });
    expect(calculation.trace.map((step) => step.step)).toEqual([
      'prior_decay', 'likelihood_known', 'likelihood_unknown', 'bayesian_update', 'learning_transition',
    ]);
    expect(calculation.trace.every((step) => step.explanation && step.symbols.length > 0)).toBe(true);
    expect(calculation.trace.flatMap((step) => [step.substitution, step.calculation])
      .every((value) => !/\.\d{5,}/.test(value))).toBe(true);
    expect(formatFormulaNumber(0.4721601339)).toBe('0.4722');
    expect(formatFormulaNumber(0.35)).toBe('0.3500');
    expect(formatModelNumber(0.350000)).toBe('0.35');
    expect(formatModelPercent(0.4721601339)).toBe('47.22%');
    expect(formatPercentageValue(47.21601339)).toBe('47.22%');
    expect(formatModelDays(7.83000)).toBe('7.83 days');
  });
});

describe('quiz scoring and Phase 1 question sets', () => {
  it('uses the existing rounded percentage rule', () => {
    expect(calculatePercentCorrect(4, 5)).toBe(80);
    expect(calculatePercentCorrect(2, 5)).toBe(40);
  });

  it('grades database MCQ answers without trusting client scores', () => {
    const mcq: QuizQuestion = {
      questionKey: 'biology-ecology:v1:q01', type: 'mcq', topic: 'Ecology', text: 'Question',
      options: ['A', 'B'], correctAnswer: 0, explanation: 'Explanation', linkedConcept: 'Ecology',
    };
    expect(gradeQuestion(mcq, 0)).toBe(true);
    expect(gradeQuestion(mcq, '0')).toBe(false);
  });

  it('never exposes placement answers before submission', () => {
    const question: QuizQuestion = {
      questionKey: 'biology-ecology:v1:q01', type: 'mcq', topic: 'Ecology', text: 'Question',
      options: ['A', 'B'], correctAnswer: 0, explanation: 'Secret', linkedConcept: 'Ecology',
    };
    const [publicQuestion] = serializePlacementQuestions([question]);
    expect(publicQuestion).not.toHaveProperty('correctAnswer');
    expect(publicQuestion).not.toHaveProperty('explanation');
    expect(publicQuestion).not.toHaveProperty('linkedConcept');
  });

  it('selects deterministic ten-question MCQ and five-question Essay sets', () => {
    const chemistryRows = questionRows.filter((row) => row.topicId.startsWith('chemistry-'));
    const atomicStructure = topicById.get('chemistry-atomic-structure')!;
    const mcq = selectQuestionRows(chemistryRows, atomicStructure.id, atomicStructure.position, 'mcq', 'attempt')!;
    const repeated = selectQuestionRows(chemistryRows, atomicStructure.id, atomicStructure.position, 'mcq', 'attempt')!;
    const essay = selectQuestionRows(chemistryRows, atomicStructure.id, atomicStructure.position, 'essay', 'attempt')!;
    const placement = selectQuestionRows(chemistryRows, atomicStructure.id, atomicStructure.position, 'placement', 'attempt')!;

    expect(mcq).toHaveLength(10);
    expect(mcq.every((question) => question.topicId === atomicStructure.id && question.type === 'mcq')).toBe(true);
    expect(mcq.map((question) => question.id)).toEqual(repeated.map((question) => question.id));
    expect(essay).toHaveLength(5);
    expect(essay.every((question) => question.type === 'structured' && question.maxMarks === 10)).toBe(true);
    expect(placement).toHaveLength(10);
  });

  it('maps all fixture questions to unique stable keys', () => {
    const keys = questionRows.map((question) => questionKeyFromDatabaseId(question.id, question.topicId));
    expect(topicSeed).toHaveLength(13);
    expect(questionRows).toHaveLength(208);
    expect(new Set(keys).size).toBe(208);
  });
});
