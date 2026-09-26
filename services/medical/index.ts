// services/medical/index.ts
// نقطة تجميع (barrel) لكل خدمات المكتبة الطبية + إعدادات عامة.

export * from './diseaseLibrary';
export * from './rxNorm';
export * from './openFda';
export * from './medlinePlusConnect';
export * from './regionTaxonomy';

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
