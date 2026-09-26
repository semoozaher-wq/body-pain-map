// services/medical/regionTaxonomy.ts
// تصنيف تشريحي هرمي: المنطقة الأساسية → المنطقة الفرعية → البنية المحددة.
// يوفر الربط بين كل بنية تشريحية والحالات المرضية المرتبطة بها (offline بالكامل).
import taxonomyData from '../../data/medical/regionTaxonomy.json';
import { getAllConditions, type MedicalCondition, type Language } from './diseaseLibrary';

export interface LocalizedPair { ar: string; en: string; }
export interface SizeBandLabel { ar: string; en: string; }

export interface AnatomicalStructure {
  id: string;
  subRegionId: string;
  type: string;
  label: LocalizedPair;
  sizeBand: string;
  sizeBandLabel: SizeBandLabel;
}

export interface AnatomicalSubRegion {
  id: string;
  regionId: string;
  label: LocalizedPair;
  icdChapterHint: string;
  structures: AnatomicalStructure[];
}

export interface AnatomicalRegion {
  id: string;
  label: LocalizedPair;
  subRegions: AnatomicalSubRegion[];
}

interface TaxonomyDoc {
  schemaVersion: string;
  generatedAt: string;
  granularity: string;
  notice: LocalizedPair;
  sizeBands: Record<string, SizeBandLabel>;
  structureTypes: string[];
  regions: AnatomicalRegion[];
}

const DOC = taxonomyData as unknown as TaxonomyDoc;

/** نص ثنائي اللغة للمنطقة/البنية (ar/en) مع الرجوع للعربية. */
export function localizePair(value: LocalizedPair, language: Language): string {
  return language === 'en' ? value.en : value.ar;
}

/** كل المناطق الأساسية (5 مناطق). */
export function getTaxonomy(): AnatomicalRegion[] {
  return DOC.regions;
}

/** منطقة أساسية واحدة. */
export function getRegion(regionId: string): AnatomicalRegion | null {
  return DOC.regions.find((r) => r.id === regionId) ?? null;
}

/** المناطق الفرعية لمنطقة أساسية. */
export function getSubRegions(regionId: string): AnatomicalSubRegion[] {
  return getRegion(regionId)?.subRegions ?? [];
}

/** منطقة فرعية واحدة. */
export function getSubRegion(subRegionId: string): AnatomicalSubRegion | null {
  for (const r of DOC.regions) {
    const s = r.subRegions.find((x) => x.id === subRegionId);
    if (s) return s;
  }
  return null;
}

/** البنى التشريحية داخل منطقة فرعية. */
export function getStructures(subRegionId: string): AnatomicalStructure[] {
  return getSubRegion(subRegionId)?.structures ?? [];
}

/** بنية تشريحية واحدة. */
export function getStructure(structureId: string): AnatomicalStructure | null {
  for (const r of DOC.regions) for (const s of r.subRegions) {
    const st = s.structures.find((x) => x.id === structureId);
    if (st) return st;
  }
  return null;
}

/** كل البنى المُحتملة كخريطة id → بنية (للبحث والتحقق). */
export function getAllStructures(): AnatomicalStructure[] {
  return DOC.regions.flatMap((r) => r.subRegions.flatMap((s) => s.structures));
}

/** الحالات المرضية المرتبطة بمنطقة فرعية محددة. */
export function getConditionsBySubRegion(subRegionId: string): MedicalCondition[] {
  return getAllConditions().filter((c) => c.taxonomy?.subRegion === subRegionId);
}

/** الحالات المرضية المرتبطة ببنية تشريحية محددة (مثل: نفق الرسغ، وتر أخيل). */
export function getConditionsByStructure(structureId: string): MedicalCondition[] {
  return getAllConditions().filter((c) => c.taxonomy?.structures?.includes(structureId));
}

/** البنى التي تملك حالة مرضية واحدة على الأقل. */
export function getMappedStructures(): AnatomicalStructure[] {
  return getAllStructures().filter((s) => getConditionsByStructure(s.id).length > 0);
}

/** إحصاءات التصنيف التشريحي. */
export function getTaxonomyStats() {
  const subRegions = DOC.regions.reduce((n, r) => n + r.subRegions.length, 0);
  const structures = getAllStructures();
  const byBand: Record<string, number> = {};
  structures.forEach((s) => { byBand[s.sizeBand] = (byBand[s.sizeBand] ?? 0) + 1; });
  return {
    generatedAt: DOC.generatedAt,
    regions: DOC.regions.length,
    subRegions,
    structures: structures.length,
    mappedStructures: getMappedStructures().length,
    structureTypes: DOC.structureTypes.length,
    bySizeBand: byBand,
  };
}

/** ملاحظة النطاق (تنبيه أن الحجم تقديري وليس قياسًا فعليًا). */
export function getTaxonomyNotice(language: Language): string {
  return localizePair(DOC.notice, language);
}
