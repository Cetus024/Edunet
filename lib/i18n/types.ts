export const LOCALES = ['en', 'zh'] as const;

export type Locale = (typeof LOCALES)[number];

/**
 * Every user-facing string carries both languages side by side rather than
 * living in separate per-locale files. Keeping the pair together means a new
 * string cannot be added in English only without the gap being obvious at the
 * point of editing, which is the failure mode that leaves half-translated UIs.
 */
export type Translation = { en: string; zh: string };

export type Dictionary = Record<string, Translation>;

export const LOCALE_LABELS: Record<Locale, string> = {
  en: 'English',
  zh: '华文',
};
