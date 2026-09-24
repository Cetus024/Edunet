/**
 * Localised question text, served from a bundled fixture rather than the
 * database. The v2 Mathematics/Chemistry bank currently falls back to its
 * authored English copy until reviewed translations are supplied.
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
  zh: { version: 2, locale: 'zh', questions: {} },
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
