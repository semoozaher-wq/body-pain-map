// services/medical/index.ts
// نقطة تجميع (barrel) لكل خدمات المكتبة الطبية + إعدادات عامة.

export * from './diseaseLibrary';
export * from './rxNorm';
export * from './openFda';
export * from './medlinePlusConnect';
// Keep the disease-library API as the canonical barrel names. The taxonomy
// module contains similarly named helpers, so export those under explicit
// anatomical names instead of creating ambiguous star exports.
export {
  localizePair,
  getTaxonomy as getAnatomicalTaxonomy,
  getRegion as getAnatomicalRegion,
  getSubRegions as getAnatomicalSubRegions,
  getSubRegion as getAnatomicalSubRegion,
  getStructures as getAnatomicalStructures,
  getStructure as getAnatomicalStructure,
  getAllStructures as getAllAnatomicalStructures,
  getConditionsBySubRegion as getAnatomicalConditionsBySubRegion,
  getConditionsByStructure as getAnatomicalConditionsByStructure,
  getMappedStructures,
  getTaxonomyStats as getAnatomicalTaxonomyStats,
  getTaxonomyNotice as getAnatomicalTaxonomyNotice,
} from './regionTaxonomy';
export type { LocalizedPair, SizeBandLabel, AnatomicalStructure, AnatomicalSubRegion, AnatomicalRegion } from './regionTaxonomy';

/**
 * إعدادات الطبقة الطبية.
 * - offlineLibrary: مكتبة الأمراض/الأعراض المحلية (دائمًا متاحة، بدون شبكة).
 * - liveDrugLookup: البحث الشبكي عن الأدوية (RxNorm/openFDA) — اختياري.
 * - medlinePlusConnect: ربط الأكواد بمحتوى NLM — اختياري.
 */
export const MEDICAL_SETTINGS = {
  offlineLibrary: true,
  liveDrugLookup: true,
  medlinePlusConnect: true,
  /** حد أقصى لعدد النتائج المعروضة في البحث. */
  maxResults: 20,
  /** مهلة الشبكة بالمللي ثانية. */
  networkTimeoutMs: 9000,
} as const;

export type MedicalSettings = typeof MEDICAL_SETTINGS;
