import { describe, expect, it } from 'vitest';

import { quizQuestionSeed, topicSeed } from '../../../database/seed-data.js';
import {
  gradeQuestion,
  questionKeyFromDatabaseId,
  selectQuestionRows,
  serializePlacementQuestions,
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

  it('never exposes placement answers or explanations before submission', () => {
    const question: QuizQuestion = {
      questionKey: 'biology-ecology:v1:q01',
      type: 'mcq',
      topic: 'Ecology',
      text: 'Question',
      options: ['A', 'B'],
      correctAnswer: 0,
      explanation: 'Secret explanation',
      linkedConcept: 'Ecology',
    };
    const [publicQuestion] = serializePlacementQuestions([question]);
    expect(publicQuestion).not.toHaveProperty('correctAnswer');
    expect(publicQuestion).not.toHaveProperty('explanation');
    expect(publicQuestion).not.toHaveProperty('linkedConcept');
  });

  it('schedules 09:00 Singapore time independently of host timezone', () => {
    const result = calculateNextReviewAt(95, new Date('2026-07-31T18:00:00.000Z'));
    expect(result.toISOString()).toBe('2026-08-08T01:00:00.000Z');
  });

  it('derives stable, padded historical keys from database IDs', () => {
    expect(questionKeyFromDatabaseId('a-math-trigonometry-q003', 'a-math-trigonometry'))
      .toBe('a-math-trigonometry:v1:q03');
  });

  it('selects deterministic database-backed sets without placement changing practice modes', () => {
    const biologyRows = questionRows.filter((row) => row.topicId.startsWith('biology-'));
    const ecology = topicById.get('biology-ecology')!;
    const paperOne = selectQuestionRows(biologyRows, ecology.id, ecology.position, 'past-paper', 'paper-attempt', 'paper-1')!;
    const paperTwo = selectQuestionRows(biologyRows, ecology.id, ecology.position, 'past-paper', 'paper-attempt', 'paper-2')!;
    const concept = selectQuestionRows(biologyRows, ecology.id, ecology.position, 'concept-check', 'concept-attempt')!;
    const speed = selectQuestionRows(biologyRows, ecology.id, ecology.position, 'speed-round', 'speed-attempt')!;
    const repeatedSpeed = selectQuestionRows(biologyRows, ecology.id, ecology.position, 'speed-round', 'speed-attempt')!;
    const differentSpeed = selectQuestionRows(biologyRows, ecology.id, ecology.position, 'speed-round', 'another-attempt')!;
    const placement = selectQuestionRows(biologyRows, ecology.id, ecology.position, 'placement', 'placement-attempt')!;
    const repeatedPlacement = selectQuestionRows(biologyRows, ecology.id, ecology.position, 'placement', 'placement-attempt')!;

    expect(paperOne).toHaveLength(21);
    expect(paperOne.every((question) => question.type === 'mcq')).toBe(true);
    expect(paperTwo).toHaveLength(14);
    expect(paperTwo.every((question) => question.type !== 'mcq')).toBe(true);
    expect(concept).toHaveLength(5);
    expect(concept.every((question) => question.topicId === ecology.id)).toBe(true);
    expect(speed).toHaveLength(5);
    expect(speed.every((question) => question.type === 'mcq')).toBe(true);
    expect(speed.map((question) => question.id)).toEqual(repeatedSpeed.map((question) => question.id));
    expect(speed.map((question) => question.id)).not.toEqual(differentSpeed.map((question) => question.id));
    expect(placement).toHaveLength(10);
    expect(placement.every((question) => question.topicId === ecology.id && question.type === 'mcq')).toBe(true);
    expect(placement.map((question) => question.id)).toEqual(repeatedPlacement.map((question) => question.id));
  });

  it('maps all fixture questions to existing topic IDs and stable keys', () => {
    const keys = questionRows.map((question) => {
      expect(topicById.has(question.topicId), question.id).toBe(true);
      return questionKeyFromDatabaseId(question.id, question.topicId);
    });

    expect(topicSeed).toHaveLength(51);
    expect(questionRows).toHaveLength(612);
    expect(new Set(keys).size).toBe(612);
  });
});
