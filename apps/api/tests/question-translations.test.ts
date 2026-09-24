import { describe, expect, it } from 'vitest';

import {
  getQuestionTranslation,
  localizeExplanation,
  localizeQuestion,
  localizeQuestions,
  parseLocale,
  translationCoverage,
} from '../src/lib/question-translations.js';

const ENGLISH = {
  questionKey: 'math-number-algebra:v2:q01',
  text: 'Write 0.00056 in standard form.',
  options: ['A', 'B', 'C', 'D'],
};

describe('question localization', () => {
  it('parses Chinese locales and defaults other values to English', () => {
    expect(parseLocale('zh-CN')).toBe('zh');
    expect(parseLocale('en-SG')).toBe('en');
    expect(parseLocale(undefined)).toBe('en');
  });

  it('falls back to the authored English v2 bank until a reviewed translation exists', () => {
    expect(localizeQuestion(ENGLISH, 'zh')).toBe(ENGLISH);
    expect(localizeQuestion(ENGLISH, 'en')).toBe(ENGLISH);
    expect(localizeQuestions([ENGLISH], 'zh')).toEqual([ENGLISH]);
    expect(localizeExplanation(ENGLISH.questionKey, 'original', 'zh')).toBe('original');
    expect(getQuestionTranslation(ENGLISH.questionKey, 'zh')).toBeNull();
    expect(translationCoverage('zh')).toEqual({ translated: 0, reviewed: 0 });
  });
});
