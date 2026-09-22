import { describe, expect, it } from 'vitest';

import { EXPECTED_CATALOG_COUNTS } from '../../../packages/database/constants.js';
import { quizQuestionSeed, subjectSeed, topicSeed } from '../../../packages/database/seed-data.js';
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
} from '../../../apps/web/lib/knowledge-number-format.js';
import {
  gradeQuestion,
  questionKeyFromDatabaseId,
  selectQuestionRows,
  type QuestionPoolRow,
  type QuizQuestion,
} from '../src/lib/question-bank.js';
import {
  calculateMemoryScore,
  calculateNextReviewAt,
  calculatePercentCorrect,
} from '../src/lib/scoring.js';

const topicById = new Map(topicSeed.map((topic) => [topic.id, topic]));
const questionRows: QuestionPoolRow[] = quizQuestionSeed.map((question) => {
  const topic = topicById.get(question.topicId)!;
  return {
    ...question,
    topicName: topic.name,
    topicPosition: topic.position,
  };
});

describe('quiz scoring', () => {
  it.each([
    [100, 95],
    [90, 95],
    [89, 80],
    [75, 80],
    [55, 62],
    [40, 45],
    [0, 28],
  ])('maps %s%% to memory score %s', (percent, expected) => {
    expect(calculateMemoryScore(percent)).toBe(expected);
  });

  it('uses the existing rounded percentage rule', () => {
    expect(calculatePercentCorrect(4, 5)).toBe(80);
    expect(calculatePercentCorrect(2, 5)).toBe(40);
  });

  it('grades hydrated database answers without trusting client scores', () => {
    const mcq: QuizQuestion = {
      questionKey: 'biology-ecology:v1:q01',
      type: 'mcq',
      topic: 'Ecology',
      text: 'Question',
      options: ['A', 'B'],
      correctAnswer: 0,
      explanation: 'Explanation',
      linkedConcept: 'Ecology',
    };
    const structured: QuizQuestion = { ...mcq, type: 'structured', correctAnswer: 'habitat loss' };

    expect(gradeQuestion(mcq, 0)).toBe(true);
    expect(gradeQuestion(mcq, '0')).toBe(false);
    expect(gradeQuestion(structured, 'It causes habitat loss.')).toBe(true);
  });

  it('schedules 09:00 Singapore time independently of host timezone', () => {
    const result = calculateNextReviewAt(95, new Date('2026-07-31T18:00:00.000Z'));
    expect(result.toISOString()).toBe('2026-08-08T01:00:00.000Z');
  });

  it('derives stable, padded historical keys from database IDs', () => {
    expect(questionKeyFromDatabaseId('a-math-trigonometry-q003', 'a-math-trigonometry'))
      .toBe('a-math-trigonometry:v1:q03');
  });

  it('selects deterministic database-backed sets for all three modes', () => {
    const subjectId = subjectSeed[0]!.id;
    const subjectTopicIds = new Set(
      topicSeed.filter((topic) => topic.subjectId === subjectId).map((topic) => topic.id),
    );
    const subjectRows = questionRows.filter((row) => subjectTopicIds.has(row.topicId));
    const topic = topicSeed.find((item) => item.subjectId === subjectId)!;
    const paperOne = selectQuestionRows(subjectRows, topic.id, topic.position, 'past-paper', 'paper-attempt', 'paper-1')!;
    const paperTwo = selectQuestionRows(subjectRows, topic.id, topic.position, 'past-paper', 'paper-attempt', 'paper-2')!;
    const concept = selectQuestionRows(subjectRows, topic.id, topic.position, 'concept-check', 'concept-attempt')!;
    const speed = selectQuestionRows(subjectRows, topic.id, topic.position, 'speed-round', 'speed-attempt')!;
    const repeatedSpeed = selectQuestionRows(subjectRows, topic.id, topic.position, 'speed-round', 'speed-attempt')!;
    const differentSpeed = selectQuestionRows(subjectRows, topic.id, topic.position, 'speed-round', 'another-attempt')!;

    expect(paperOne).toHaveLength(subjectRows.filter((row) => row.type === 'mcq').length);
    expect(paperOne.every((question) => question.type === 'mcq')).toBe(true);
    expect(paperTwo).toHaveLength(subjectRows.filter((row) => row.type !== 'mcq').length);
    expect(paperTwo.every((question) => question.type !== 'mcq')).toBe(true);
    expect(concept).toHaveLength(5);
    expect(concept.every((question) => question.topicId === topic.id)).toBe(true);
    expect(speed).toHaveLength(5);
    expect(speed.every((question) => question.type === 'mcq')).toBe(true);
    expect(speed.map((question) => question.id)).toEqual(repeatedSpeed.map((question) => question.id));
    expect(speed.map((question) => question.id)).not.toEqual(differentSpeed.map((question) => question.id));
  });

  it('maps all fixture questions to existing topic IDs and stable keys', () => {
    const keys = questionRows.map((question) => {
      expect(topicById.has(question.topicId), question.id).toBe(true);
      return questionKeyFromDatabaseId(question.id, question.topicId);
    });

    expect(topicSeed).toHaveLength(EXPECTED_CATALOG_COUNTS.topics);
    expect(questionRows).toHaveLength(EXPECTED_CATALOG_COUNTS.questions);
    expect(new Set(keys).size).toBe(EXPECTED_CATALOG_COUNTS.questions);
  });
});
