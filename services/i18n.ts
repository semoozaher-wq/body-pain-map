import ar from '../locales/ar.json';
import en from '../locales/en.json';
import fr from '../locales/fr.json';

export type Language = 'ar' | 'en' | 'fr';
export const dictionaries = { ar, en, fr } as const;
export const languageOrder: Language[] = ['ar', 'en', 'fr'];
export function directionFor(language: Language): 'rtl' | 'ltr' {
  return language === 'ar' ? 'rtl' : 'ltr';
}

/** Resolve top-level and dotted keys, with Arabic as a safe fallback. */
export function translate(language: Language, key: string): string {
  const read = (dictionary: unknown): string | undefined => {
    const value = key.split('.').reduce<unknown>((current, segment) => {
      if (!current || typeof current !== 'object') return undefined;
      return (current as Record<string, unknown>)[segment];
    }, dictionary);
    return typeof value === 'string' ? value : undefined;
  };

  return read(dictionaries[language]) ?? read(dictionaries.ar) ?? key;
}
