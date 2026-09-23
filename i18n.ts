import ar from '../locales/ar.json';
import en from '../locales/en.json';
import fr from '../locales/fr.json';

export type Language = 'ar' | 'en' | 'fr';
export const dictionaries = { ar, en, fr } as const;
export const languageOrder: Language[] = ['ar', 'en', 'fr'];
export function directionFor(language: Language) { return language === 'ar' ? 'rtl' : 'ltr'; }
export function translate(language: Language, key: keyof typeof ar): string { return dictionaries[language][key] ?? dictionaries.ar[key]; }
