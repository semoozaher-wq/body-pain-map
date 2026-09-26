// hooks/useMedicalLibrary.ts
// Hooks للوصول إلى مكتبة الأمراض والأعراض المحلية (offline).

import { useMemo } from 'react';
import {
  getAllConditions,
  getAllSymptoms,
  getConditionById,
  getConditionsByMuscleGroup,
  getConditionsByRegion,
  getLibraryStats,
  getSymptomById,
  getSymptomsByRegion,
  getSymptomsForCondition,
  localize,
  searchMedicalLibrary,
  type Language,
  type MedicalCondition,
  type MedicalSymptom,
} from '../services/medical/diseaseLibrary';

/** كل الأمراض المحلية. */
export function useAllConditions(): MedicalCondition[] {
  return useMemo(() => getAllConditions(), []);
}

/** كل الأعراض المحلية. */
export function useAllSymptoms(): MedicalSymptom[] {
  return useMemo(() => getAllSymptoms(), []);
}

/** حالة مرضية واحدة بالمعرّف. */
export function useCondition(id: string | null): MedicalCondition | null {
  return useMemo(() => (id ? getConditionById(id) : null), [id]);
}

/** عرض واحد بالمعرّف. */
export function useSymptom(id: string | null): MedicalSymptom | null {
  return useMemo(() => (id ? getSymptomById(id) : null), [id]);
}

/** الأمراض المرتبطة بمجموعة عضلات. */
export function useConditionsByMuscleGroup(group: string | null): MedicalCondition[] {
  return useMemo(() => (group ? getConditionsByMuscleGroup(group) : []), [group]);
}

/** الأمراض المرتبطة بمنطقة جسم. */
export function useConditionsByRegion(region: string | null): MedicalCondition[] {
  return useMemo(() => (region ? getConditionsByRegion(region) : []), [region]);
}

/** الأعراض المرتبطة بمنطقة جسم. */
export function useSymptomsByRegion(region: string | null): MedicalSymptom[] {
  return useMemo(() => (region ? getSymptomsByRegion(region) : []), [region]);
}

/** الأعراض المرتبطة بحالة مرضية. */
export function useSymptomsForCondition(condition: MedicalCondition | null): MedicalSymptom[] {
  return useMemo(() => (condition ? getSymptomsForCondition(condition) : []), [condition]);
}

/** بحث نصي في المكتبة. */
export function useMedicalSearch(query: string) {
  return useMemo(() => searchMedicalLibrary(query), [query]);
}

/** إحصائيات المكتبة. */
export function useMedicalLibraryStats() {
  return useMemo(() => getLibraryStats(), []);
}

/** نص مُترجم لحالة مرضية (اسم/ملخص/علامات خطر). */
export function useLocalizedCondition(condition: MedicalCondition | null, language: Language) {
  return useMemo(() => {
    if (!condition) return null;
    return {
      name: localize(condition.name, language),
      summary: localize(condition.summary, language),
      redFlags: localize(condition.redFlags, language),
      icd10: condition.icd10,
      doid: condition.doid,
      medlinePlusUrl: condition.medlinePlusUrl,
      sources: condition.sources,
    };
  }, [condition, language]);
}
