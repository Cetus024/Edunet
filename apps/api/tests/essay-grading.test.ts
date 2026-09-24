import { describe, expect, it } from 'vitest';

import {
  inferMarkCode,
  normalizeGrade,
  parseGradeJson,
} from '../src/services/essay-grading.js';

describe('parseGradeJson', () => {
  it('parses plain JSON with defaults', () => {
    expect(parseGradeJson('{"marksObtained":1,"maximumMarks":1,"verdict":"correct"}')).toEqual({
      marksObtained: 1,
      maximumMarks: 1,
      verdict: 'correct',
      summary: '',
      markPoints: [],
      parts: [],
    });
  });

  it('parses mark points and sense bonus', () => {
    const parsed = parseGradeJson(`\`\`\`json
{"marksObtained":1,"maximumMarks":3,"verdict":"sense","summary":"On topic but missed the scheme.","markPoints":[{"id":"B1","code":"B","earned":false,"marks":1,"schemeSentence":"Student A is correct.","analysis":"You did not name which student."}],"senseBonus":{"awarded":1,"reason":"Mentions electrolysis vaguely."},"parts":[]}
\`\`\``);
    expect(parsed.verdict).toBe('sense');
    expect(parsed.markPoints).toHaveLength(1);
    expect(parsed.markPoints[0]?.schemeSentence).toContain('Student A');
    expect(parsed.markPoints[0]?.code).toBe('B');
    expect(parsed.senseBonus).toEqual({ awarded: 1, reason: 'Mentions electrolysis vaguely.' });
  });
});

describe('inferMarkCode', () => {
  it('prefers explicit code then id letter', () => {
    expect(inferMarkCode('X1', 'M')).toBe('M');
    expect(inferMarkCode('A1')).toBe('A');
    expect(inferMarkCode('m2')).toBe('M');
    expect(inferMarkCode('point')).toBe('B');
  });
});

describe('normalizeGrade B/M/A', () => {
  it('strips A when its required M was not earned', () => {
    const result = normalizeGrade({
      marksObtained: 2,
      maximumMarks: 2,
      verdict: 'partial',
      summary: '',
      markPoints: [
        {
          id: 'M1',
          code: 'M',
          earned: false,
          marks: 1,
          schemeSentence: 'Valid method shown.',
          analysis: 'Method missing.',
        },
        {
          id: 'A1',
          code: 'A',
          earned: true,
          marks: 1,
          dependsOn: 'M1',
          schemeSentence: 'Correct final value.',
          analysis: 'Answer looks right.',
        },
      ],
      parts: [],
    }, 2);

    expect(result.feedback.markPoints.find((point) => point.id === 'A1')?.earned).toBe(false);
    expect(result.marksObtained).toBe(0);
    expect(result.verdict).toBe('incorrect');
  });

  it('keeps A when dependsOn M is earned', () => {
    const result = normalizeGrade({
      marksObtained: 2,
      maximumMarks: 2,
      verdict: 'correct',
      summary: 'Full method and accuracy.',
      markPoints: [
        {
          id: 'M1',
          code: 'M',
          earned: true,
          marks: 1,
          schemeSentence: 'Valid method.',
          analysis: 'Good working.',
        },
        {
          id: 'A1',
          code: 'A',
          earned: true,
          marks: 1,
          dependsOn: 'M1',
          schemeSentence: 'Correct value.',
          analysis: 'Accurate.',
        },
      ],
      parts: [],
    }, 2);

    expect(result.marksObtained).toBe(2);
    expect(result.verdict).toBe('correct');
    expect(result.feedback.markPoints.every((point) => point.earned)).toBe(true);
  });

  it('auto-links A to preceding M and caps total to maximumMarks', () => {
    const result = normalizeGrade({
      marksObtained: 5,
      maximumMarks: 5,
      verdict: 'partial',
      summary: '',
      markPoints: [
        {
          id: 'B1',
          code: 'B',
          earned: true,
          marks: 1,
          schemeSentence: 'Fact.',
          analysis: 'Ok.',
        },
        {
          id: 'M1',
          code: 'M',
          earned: true,
          marks: 1,
          schemeSentence: 'Method.',
          analysis: 'Ok.',
        },
        {
          id: 'A1',
          code: 'A',
          earned: true,
          marks: 1,
          schemeSentence: 'Accuracy.',
          analysis: 'Ok.',
        },
        {
          id: 'B2',
          code: 'B',
          earned: true,
          marks: 2,
          schemeSentence: 'Extra invent.',
          analysis: 'Should be clipped.',
        },
      ],
      parts: [],
    }, 3);

    expect(result.feedback.markPoints.find((point) => point.id === 'A1')?.dependsOn).toBe('M1');
    expect(result.marksObtained).toBe(3);
    expect(result.feedback.markPoints.reduce((sum, point) => sum + point.marks, 0)).toBe(3);
  });
});
