import { describe, expect, it } from 'vitest';

import translationsZh from '../../../database/fixtures/quiz-translations.zh.json' with { type: 'json' };
import {
  getQuestionTranslation,
  localizeExplanation,
  localizeQuestion,
  localizeQuestions,
  parseLocale,
  translationCoverage,
} from '../src/lib/question-translations.js';

const ENGLISH = {
  questionKey: 'biology-genetics:v1:q03',
  text: 'Which genotype is heterozygous?',
  options: ['TT', 'tt', 'Tt', 'T'],
};

describe('parseLocale', () => {
  it('accepts the zh family and defaults everything else to English', () => {
    expect(parseLocale('zh')).toBe('zh');
    expect(parseLocale('zh-CN')).toBe('zh');
    expect(parseLocale('ZH-Hans')).toBe('zh');
    expect(parseLocale('en-SG')).toBe('en');
    expect(parseLocale(undefined)).toBe('en');
    expect(parseLocale('')).toBe('en');
  });
});

describe('localizeQuestion', () => {
  it('replaces text and options for a translated question', () => {
    const localized = localizeQuestion(ENGLISH, 'zh');
    expect(localized.text).toBe('下列哪个基因型是杂合的？');
    expect(localized.options).toEqual(['TT', 'tt', 'Tt', 'T']);
  });

  it('returns the English question untouched when the locale is English', () => {
    expect(localizeQuestion(ENGLISH, 'en')).toBe(ENGLISH);
  });

  it('falls back to English for an untranslated question', () => {
    const templated = {
      questionKey: 'biology-cell-division-mitosis:v1:q07',
      text: 'Which statement best explains "Stages of Mitosis"?',
      options: ['a', 'b', 'c', 'd'],
    };
    expect(localizeQuestion(templated, 'zh')).toBe(templated);
  });

  it('keeps the original options when the translated array is a different length', () => {
    // The correct answer is an index into this array. A translation with a
    // different length would silently re-point it at another option, turning a
    // right answer into a wrong one -- so the guard matters more than the
    // translation does.
    const mismatched = { ...ENGLISH, options: ['TT', 'tt', 'Tt'] };
    expect(localizeQuestion(mismatched, 'zh').options).toEqual(['TT', 'tt', 'Tt']);
  });

  it('localizes a list and leaves untranslated members in English', () => {
    const [translated, untouched] = localizeQuestions(
      [ENGLISH, { questionKey: 'nope:v1:q01', text: 'Untranslated', options: [] }],
      'zh',
    );
    expect(translated.text).not.toBe(ENGLISH.text);
    expect(untouched.text).toBe('Untranslated');
  });
});

describe('localizeExplanation', () => {
  it('returns the translated explanation, or the original when absent', () => {
    expect(localizeExplanation('biology-genetics:v1:q03', 'original', 'zh'))
      .toBe('杂合基因型含有两个不同的等位基因，例如 Tt。');
    expect(localizeExplanation('nope:v1:q01', 'original', 'zh')).toBe('original');
    expect(localizeExplanation('biology-genetics:v1:q03', 'original', 'en')).toBe('original');
  });
});

describe('the zh fixture', () => {
  const entries = Object.entries(translationsZh.questions as Record<string, {
    text: string;
    options?: string[];
    explanation?: string;
    reviewed: boolean;
  }>);

  it('uses the questionKey format the question bank derives', () => {
    for (const [key] of entries) {
      expect(key).toMatch(/^[a-z0-9-]+:v1:q\d{2}$/);
    }
  });

  it('gives every entry non-empty text and an explicit reviewed flag', () => {
    for (const [key, value] of entries) {
      expect(value.text.trim(), key).not.toBe('');
      expect(typeof value.reviewed, key).toBe('boolean');
    }
  });

  it('never carries an empty or single-option answer list', () => {
    for (const [key, value] of entries) {
      if (!value.options) continue;
      expect(value.options.length, key).toBeGreaterThan(1);
      for (const option of value.options) expect(option.trim(), key).not.toBe('');
    }
  });

  it('reports coverage', () => {
    const coverage = translationCoverage('zh');
    expect(coverage.translated).toBe(entries.length);
    expect(coverage.reviewed).toBeLessThanOrEqual(coverage.translated);
  });

  it('has no translation for a question the English bank does not define', () => {
    expect(getQuestionTranslation('definitely-not-a-topic:v1:q01', 'zh')).toBeNull();
  });
});
