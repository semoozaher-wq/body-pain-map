import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { directionFor, type Language } from '../services/i18n';

const KEY = 'bodymap-language-v1';
export function useLanguage() {
  const [language, setLanguageState] = useState<Language>('ar');
  useEffect(() => { AsyncStorage.getItem(KEY).then((value) => { if (value === 'ar' || value === 'en' || value === 'fr') setLanguageState(value); }).catch(() => undefined); }, []);
  const setLanguage = (value: Language) => { setLanguageState(value); AsyncStorage.setItem(KEY, value).catch(() => undefined); };
  return { language, setLanguage, direction: directionFor(language) };
}
