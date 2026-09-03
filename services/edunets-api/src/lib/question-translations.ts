import translationsZh from '../../../../database/fixtures/quiz-translations.zh.json' with { type: 'json' };

/**
 * Localised question text, served from a bundled fixture rather than the
 * database.
 *
 * Questions themselves belong in Postgres because they are selected, filtered
 * and scored by SQL. Translations are not: they are looked up by key for
 * display and take part in no query. Keeping them as static reference data --
 * the same shape `quiz-catalog.json` already is -- means no migration, no
 * schema change on `quiz_questions`, and no coordination cost with whoever is
 * working on the question bank.
 *
 * Coverage is deliberately partial. Only the 251 authored questions are
 * translated; the 361 template-generated ones ("Which statement best explains
 * ...") are left in English, because their distractors are explanation
 * sentences lifted verbatim from unrelated topics and they do not test subject
 * knowledge. Anything without an entry falls back to English, so partial
 * coverage renders correctly instead of rendering blank.
 */

export type SupportedLocale = 'en' | 'zh';

export type QuestionTranslation = {
  text: string;
  options?: string[];
  explanation?: string;
  /**
   * False until a person has checked the machine-produced draft. Science and
   * maths terms are exactly where machine translation fails quietly -- "mole",
   * "cell", "power" and "solution" all have wrong-but-fluent renderings -- so
   * an unchecked string has to be distinguishable from a checked one.
   */
  reviewed: boolean;
};

type TranslationFile = {
  version: number;
  locale: string;
  questions: Record<string, QuestionTranslation>;
};

const CATALOGUES: Record<Exclude<SupportedLocale, 'en'>, TranslationFile> = {
  zh: translationsZh as TranslationFile,
};

export function parseLocale(value: string | undefined | null): SupportedLocale {
  return value?.trim().toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function getQuestionTranslation(
  questionKey: string,
  locale: SupportedLocale,
): QuestionTranslation | null {
  if (locale === 'en') return null;
  return CATALOGUES[locale]?.questions[questionKey] ?? null;
}

/**
 * Applies a translation to an already-serialized question.
 *
 * Deliberately runs *after* serialization so the question bank's own selection
 * and hydration code is untouched. Options are replaced only when the
 * translated array is the same length as the original -- the correct answer is
 * an index into that array, so a translation of the wrong length would silently
 * re-point it at a different option.
 */
export function localizeQuestion<T extends { questionKey: string; text: string; options?: string[] }>(
  question: T,
  locale: SupportedLocale,
): T {
  const translation = getQuestionTranslation(question.questionKey, locale);
  if (!translation) return question;

  const options = translation.options
    && question.options
    && translation.options.length === question.options.length
    ? translation.options
    : question.options;

  return { ...question, text: translation.text, ...(options ? { options } : {}) };
}

export function localizeQuestions<T extends { questionKey: string; text: string; options?: string[] }>(
  questions: readonly T[],
  locale: SupportedLocale,
): T[] {
  return questions.map((question) => localizeQuestion(question, locale));
}

export function localizeExplanation(
  questionKey: string,
  explanation: string,
  locale: SupportedLocale,
): string {
  return getQuestionTranslation(questionKey, locale)?.explanation ?? explanation;
}

/** Coverage reporting, so "how much is still English" is answerable without a script. */
export function translationCoverage(locale: Exclude<SupportedLocale, 'en'>) {
  const entries = Object.values(CATALOGUES[locale]?.questions ?? {});
  return {
    translated: entries.length,
    reviewed: entries.filter((entry) => entry.reviewed).length,
  };
}
