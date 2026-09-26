// hooks/useDrugLookup.ts
// Hook للبحث عن الأدوية (RxNorm) وجلب الملصقات (openFDA).
// كل الاستدعاءات شبكية واختيارية — تفشل بهدوء إذا لا يوجد اتصال.

import { useCallback, useRef, useState } from 'react';
import {
  getDrugInteractions,
  searchDrugByName,
  type DrugConcept,
  type DrugInteraction,
} from '../services/medical/rxNorm';
import { getDrugLabel, type DrugLabel } from '../services/medical/openFda';

export interface DrugLookupState {
  loading: boolean;
  error: string | null;
  results: DrugConcept[];
  selected: DrugConcept | null;
  label: DrugLabel | null;
  interactions: DrugInteraction[];
}

const INITIAL: DrugLookupState = {
  loading: false,
  error: null,
  results: [],
  selected: null,
  label: null,
  interactions: [],
};

export function useDrugLookup() {
  const [state, setState] = useState<DrugLookupState>(INITIAL);
  const requestId = useRef(0);

  /** بحث عن دواء بالاسم. */
  const search = useCallback(async (name: string) => {
    const id = ++requestId.current;
    if (!name.trim()) {
      setState(INITIAL);
      return;
    }
    setState((prev) => ({ ...prev, loading: true, error: null, results: [], selected: null, label: null, interactions: [] }));
    const results = await searchDrugByName(name);
    if (id !== requestId.current) return; // نتيجة قديمة، تجاهل
    setState((prev) => ({
      ...prev,
      loading: false,
      results,
      error: results.length === 0 ? 'no_results' : null,
    }));
  }, []);

  /** اختيار دواء وجلب ملصقه من openFDA. */
  const select = useCallback(async (concept: DrugConcept) => {
    const id = ++requestId.current;
    setState((prev) => ({ ...prev, loading: true, error: null, selected: concept, label: null, interactions: [] }));
    const label = await getDrugLabel(concept.name);
    if (id !== requestId.current) return;
    setState((prev) => ({ ...prev, loading: false, label }));
  }, []);

  /** جلب التفاعلات الدوائية لمجموعة RxCUIs. */
  const checkInteractions = useCallback(async (rxcuis: string[]) => {
    if (rxcuis.length < 2) {
      setState((prev) => ({ ...prev, interactions: [] }));
      return;
    }
    setState((prev) => ({ ...prev, loading: true }));
    const interactions = await getDrugInteractions(rxcuis);
    setState((prev) => ({ ...prev, loading: false, interactions }));
  }, []);

  const reset = useCallback(() => setState(INITIAL), []);

  return { ...state, search, select, checkInteractions, reset };
}
