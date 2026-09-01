'use client';

import { useAtom, useAtomValue } from 'jotai';
import { atomWithStorage } from 'jotai/utils';
import { useCallback, useMemo } from 'react';

import { dictionary, type TranslationKey } from './dictionary';
import { LOCALES, LOCALE_LABELS, type Locale } from './types';

export type { Locale, TranslationKey };
export { LOCALES, LOCALE_LABELS };

/**
 * The chosen language lives in localStorage rather than on the account, so it
 * takes effect before sign-in (the login and landing pages need it too) and
 * survives without a round trip to an API that may be restructuring underneath
 * us. Moving it onto the profile later only means seeding this atom from the
 * account response.
 */
export const localeAtom = atomWithStorage<Locale>('edunets-locale', 'en');

type Vars = Record<string, string | number>;

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = vars[name];
    return value === undefined ? match : String(value);
  });
}

export function translate(locale: Locale, key: TranslationKey, vars?: Vars): string {
  const entry = dictionary[key];
  // A missing key is a programming error, not a user-facing one: fall back to
  // the key itself so the gap is visible in the UI instead of rendering blank.
  if (!entry) return key;
  return interpolate(entry[locale] || entry.en, vars);
}

export function useLocale(): Locale {
  return useAtomValue(localeAtom);
}

export function useTranslation() {
  const [locale, setLocale] = useAtom(localeAtom);

  const t = useCallback(
    (key: TranslationKey, vars?: Vars) => translate(locale, key, vars),
    [locale],
  );

  return useMemo(() => ({ t, locale, setLocale }), [t, locale, setLocale]);
}

/**
 * Picks the right side of a bilingual data pair. Catalog and syllabus rows keep
 * their English `name` as the canonical matching key — topic names are joined
 * on by value in squad-data and the concept web's `keyConnectionTopic`, so
 * translating the field in place would silently break those lookups.
 */
export function pickLocalized(locale: Locale, en: string, zh: string | undefined): string {
  return locale === 'zh' && zh ? zh : en;
}
