// hooks/useMedicalLibrary.ts
// Hooks للوصول إلى مكتبة الأمراض والأعراض المحلية (offline).

import { useMemo } from 'react';
import {
  getAllConditions,
  getStructure,
  getSubRegions,
  getTaxonomy,
  getTaxonomyNotice,
  getTaxonomyStats,
  getAllSymptoms,
  getConditionById,
  getConditionsByBatch,
  getConditionsByMuscleGroup,
  getConditionsByStructure,
  getConditionsBySubRegion,
  getConditionsByRegion,
  getLibraryStats,
  getSymptomById,
  getSymptomsByRegion,
  getSymptomsForCondition,
  getRegionalConditions,
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

/** التصنيف التشريحي الهرمي (مناطق → مناطق فرعية → بنى). */
export function useRegionTaxonomy() {
  return useMemo(() => getTaxonomy(), []);
}

/** المناطق الفرعية لمنطقة أساسية. */
export function useSubRegions(regionId: string | null) {
  return useMemo(() => (regionId ? getSubRegions(regionId) : []), [regionId]);
}

/** بنية تشريحية واحدة. */
export function useAnatomicalStructure(structureId: string | null) {
  return useMemo(() => (structureId ? getStructure(structureId) : null), [structureId]);
}

/** حالات منطقة فرعية. */
export function useConditionsBySubRegion(subRegionId: string | null) {
  return useMemo(() => (subRegionId ? getConditionsBySubRegion(subRegionId) : []), [subRegionId]);
}

/** حالات بنية تشريحية محددة. */
export function useConditionsByStructure(structureId: string | null) {
  return useMemo(() => (structureId ? getConditionsByStructure(structureId) : []), [structureId]);
}

/** إحصاءات التصنيف التشريحي. */
export function useTaxonomyStats() {
  return useMemo(() => getTaxonomyStats(), []);
}

/** ملاحظة نطاق التصنيف (تقديري وليس قياسًا). */
export function useTaxonomyNotice(language: Language) {
  return useMemo(() => getTaxonomyNotice(language), [language]);
}

/** الحالات الإقليمية المُضافة في دفعة التوسّع. */
export function useRegionalConditions(): MedicalCondition[] {
  return useMemo(() => getRegionalConditions(), []);
}

/** حالات دفعة إقليمية محددة (A | B | C). */
export function useConditionsByBatch(batch: string | null): MedicalCondition[] {
  return useMemo(() => (batch ? getConditionsByBatch(batch) : []), [batch]);
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
