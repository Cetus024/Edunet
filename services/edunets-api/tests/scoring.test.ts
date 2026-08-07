import { describe, expect, it } from 'vitest';
import { subjectSeed, topicSeed } from '../../../database/seed-data.js';
import {
  calculateMemoryScore,
  calculateNextReviewAt,
  calculatePercentCorrect,
} from '../src/lib/scoring.js';
import { getKeyedQuestions, gradeQuestion, stableQuestionKey } from '../src/lib/question-bank.js';

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

  it('uses the shared static-bank grading rule', () => {
    const questions = getKeyedQuestions('bio-ecology', 'Biology', 'Ecology');
    expect(questions).not.toBeNull();
    expect(gradeQuestion(questions![0]!, 0)).toBe(true);
    expect(gradeQuestion(questions![0]!, '0')).toBe(false);
    expect(gradeQuestion(questions![4]!, 'It causes habitat loss.')).toBe(true);
  });

  it('schedules 09:00 Singapore time independently of host timezone', () => {
    const result = calculateNextReviewAt(95, new Date('2026-07-31T18:00:00.000Z'));
    expect(result.toISOString()).toBe('2026-08-08T01:00:00.000Z');
  });

  it('creates stable, padded question keys', () => {
    expect(stableQuestionKey('amath-trig', 3)).toBe('amath-trig:v1:q03');
  });

  it('maps all 255 existing questions to stable catalog topic keys', () => {
    const subjectNames = new Map(subjectSeed.map((subject) => [subject.id, subject.name]));
    const keyedQuestions = topicSeed.flatMap((topic) => {
      const questions = getKeyedQuestions(topic.id, subjectNames.get(topic.subjectId)!, topic.name);
      expect(questions, topic.id).not.toBeNull();
      expect(questions, topic.id).toHaveLength(5);
      expect(questions!.map((question) => question.questionKey), topic.id).toEqual([
        `${topic.id}:v1:q01`,
        `${topic.id}:v1:q02`,
        `${topic.id}:v1:q03`,
        `${topic.id}:v1:q04`,
        `${topic.id}:v1:q05`,
      ]);
      return questions!;
    });

    expect(topicSeed).toHaveLength(51);
    expect(keyedQuestions).toHaveLength(255);
  });
});
