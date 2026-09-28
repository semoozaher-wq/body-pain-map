// hooks/usePainHistory.ts
// نقطة واحدة موحّدة لسجل الألم المحلي: تحميل + حفظ + إضافة + دمج + حذف.
//
// قبل هذا الـhook كان هذا المنطق مبعثرًا داخل MainApp.tsx (آثار التحميل/الحفظ
// ودوال saveResults/saveQuickLog/importHistory/clearHistory). كل الميزات
// الجديدة (دفتر الألم، التذكيرات، التقارير…) تستخدم هذا الـhook بدل تكرار
// المنطق. التخزين محلي فقط عبر AsyncStorage — لا يوجد أي إرسال لخادم.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DATA } from '../constants/appConstants';
import type { Checkup } from '../types';
import {
  mergeHistories,
  prependRecord,
  summarizeHistory,
  type HistorySummary,
} from '../services/painHistoryCore.js';

export interface UsePainHistory {
  /** السجل الحالي (من الأحدث إلى الأقدم). */
  history: Checkup[];
  /** هل تمّت محاولة تحميل السجل من التخزين المحلي؟ */
  loaded: boolean;
  /** إضافة سجل واحد في المقدمة (أحدث فحص أولًا). */
  addRecord: (record: Checkup) => void;
  /** دمج سجلات (استيراد نسخة احتياطية) بلا تكرار حسب المعرّف. */
  importRecords: (records: Checkup[]) => void;
  /** حذف كل السجل المحلي. */
  clearHistory: () => void;
  /** ملخّص وصفي بسيط للسجل (لا تشخيص). */
  summary: HistorySummary;
}

export function usePainHistory(): UsePainHistory {
  const [history, setHistory] = useState<Checkup[]>([]);
  const [loaded, setLoaded] = useState(false);
  const mounted = useRef(true);

  // تحميل السجل من التخزين المحلي مرة واحدة عند الإقلاع.
  useEffect(() => {
    mounted.current = true;
    AsyncStorage.getItem(DATA.HISTORY_STORAGE_KEY)
      .then((saved) => {
        if (!mounted.current) return;
        if (saved) {
          try {
            const parsed: unknown = JSON.parse(saved);
            if (Array.isArray(parsed)) setHistory(parsed as Checkup[]);
          } catch {
            /* الإبقاء على سجل فارغ إذا كان JSON المحفوظ تالفًا */
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

  // حفظ السجل محليًا بعد أي تغيير (بعد اكتمال التحميل الأول فقط).
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(DATA.HISTORY_STORAGE_KEY, JSON.stringify(history)).catch(() => undefined);
  }, [history, loaded]);

  const addRecord = useCallback((record: Checkup) => {
    setHistory((items) => prependRecord(items, record) as Checkup[]);
  }, []);

  const importRecords = useCallback((records: Checkup[]) => {
    setHistory((items) => mergeHistories(items, records) as Checkup[]);
  }, []);

  const clearHistory = useCallback(() => setHistory([]), []);

  const summary = useMemo(() => summarizeHistory(history), [history]);

  return { history, loaded, addRecord, importRecords, clearHistory, summary };
}

export default usePainHistory;
