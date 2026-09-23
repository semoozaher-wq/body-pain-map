import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
export type ThemeMode = 'light' | 'dark';
const KEY = 'bodymap-theme-v1';
export function useTheme() { const [mode, setMode] = useState<ThemeMode>('light'); useEffect(() => { AsyncStorage.getItem(KEY).then((v) => { if (v === 'dark' || v === 'light') setMode(v); }).catch(() => undefined); }, []); const toggle = () => { const next = mode === 'dark' ? 'light' : 'dark'; setMode(next); AsyncStorage.setItem(KEY, next).catch(() => undefined); }; return { mode, dark: mode === 'dark', toggle }; }
