// hooks/useSettings.ts
// ============================================================================
// نقطة واحدة موحّدة لإعدادات التطبيق: تحميل + حفظ + تحديث + إعادة ضبط.
// ----------------------------------------------------------------------------
// التخزين محلي فقط عبر AsyncStorage — لا سحابة ولا تسجيل دخول (البلوبرنت #14).
// المنطق النقي (الدمج مع الافتراضيات، تقييد السرعة) في services/settings/core.js.
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  DEFAULT_SETTINGS,
  SETTINGS_STORAGE_KEY,
  mergeSettings,
  type AppSettings,
} from '../services/settings/core.js';

export type { AppSettings } from '../services/settings/core.js';

export interface UseSettings {
  /** الإعدادات الحالية. */
  settings: AppSettings;
  /** هل تمّت محاولة تحميل الإعدادات من التخزين المحلي؟ */
  loaded: boolean;
  /** يحدّث جزءًا من الإعدادات (دمج جزئي). */
  updateSettings: (patch: Partial<AppSettings>) => void;
  /** يُعيد الإعدادات إلى القيم الافتراضية. */
  resetSettings: () => void;
}

export function useSettings(): UseSettings {
  const [settings, setSettings] = useState<AppSettings>({ ...DEFAULT_SETTINGS });
  const [loaded, setLoaded] = useState(false);
  const mounted = useRef(true);

  // تحميل الإعدادات من التخزين المحلي مرة واحدة عند الإقلاع.
  useEffect(() => {
    mounted.current = true;
    AsyncStorage.getItem(SETTINGS_STORAGE_KEY)
      .then((saved) => {
        if (!mounted.current) return;
        if (saved) {
          try {
            setSettings(mergeSettings(JSON.parse(saved)));
          } catch {
            /* الإبقاء على القيم الافتراضية إذا كان JSON المحفوظ تالفًا */
          }
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted.current) setLoaded(true);
      });
    return () => {
      mounted.current = false;
    };
  }, []);

  // حفظ الإعدادات محليًا بعد أي تغيير (بعد اكتمال التحميل الأول فقط).
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings)).catch(() => undefined);
  }, [settings, loaded]);

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings((prev) => mergeSettings({ ...prev, ...patch }));
  }, []);

  const resetSettings = useCallback(() => setSettings({ ...DEFAULT_SETTINGS }), []);

  return { settings, loaded, updateSettings, resetSettings };
}

export default useSettings;
