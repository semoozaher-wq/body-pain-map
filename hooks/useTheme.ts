// hooks/useTheme.ts

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../constants/colors';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  mode: ThemeMode;
  isDark: boolean;
  colors: typeof Colors;
  toggleTheme: () => void;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const THEME_STORAGE_KEY = '@bodymap_theme';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>('light');
  const [isDark, setIsDark] = useState(false);

  // تحميل الثيم المحفوظ
  useEffect(() => {
    AsyncStorage.getItem(THEME_STORAGE_KEY).then((saved) => {
      if (saved) {
        setMode(saved as ThemeMode);
      }
    });
  }, []);

  // تطبيق الثيم
  useEffect(() => {
    if (mode === 'system') {
      // يمكن استخدام Appearance من react-native
      setIsDark(false); // افتراضياً فاتح
    } else {
      setIsDark(mode === 'dark');
    }
  }, [mode]);

  const toggleTheme = () => {
    const newMode = isDark ? 'light' : 'dark';
    setMode(newMode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
  };

  const setThemeMode = (newMode: ThemeMode) => {
    setMode(newMode);
    AsyncStorage.setItem(THEME_STORAGE_KEY, newMode);
  };

  const colors = isDark ? { ...Colors, ...Colors.dark } : Colors;

  return (
    <ThemeContext.Provider value={{ mode, isDark, colors: colors as typeof Colors, toggleTheme, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
