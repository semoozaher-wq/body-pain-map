// services/medical/diseaseLibrary.ts
// مكتبة الأمراض والأعراض المحلية (offline) — مبنية على DOID + HPO + ICD-10 + MedlinePlus
// لا تعتمد على أي شبكة: كل البيانات موجودة داخل التطبيق.

import diseasesData from '../../data/medical/diseases.json';
import organConditionsData from '../../data/medical/organConditions.json';
import symptomsData from '../../data/medical/symptoms.json';

export type Language = 'ar' | 'en' | 'fr';
export type LocalizedText = { ar: string; en: string; fr: string };

export interface MedicalCondition {
  id: string;
  doid: string;
  icd10: string;
  name: LocalizedText;
  summary: LocalizedText;
  muscleGroups: string[];
  regions: string[];
  symptoms: string[];
  /** أعضاء داخلية مرتبطة بالحالة (ids مطابقة لـ ORGAN_TERMS / organDetails.json). */
  organs?: string[];
  /**
   * حالة «منتشرة» (مثل الفيبروميالجيا أو ألم العضلات العام) — تُخفَّض درجتها
   * عند وجود شكوى موضعية واحدة أو عضو محدّد، حتى لا تطغى على الأسباب الموضعية.
   */
  diffuse?: boolean;
  redFlags: LocalizedText;
  medlinePlusUrl: string;
  sources: { title: string; url: string }[];
}

export interface MedicalSymptom {
  id: string;
  hpo: string;
  name: LocalizedText;
  description: LocalizedText;
  regions: string[];
  redFlag: boolean;
}

const BASE_CONDITIONS = (diseasesData as { conditions: MedicalCondition[] }).conditions;
const ORGAN_CONDITIONS = (organConditionsData as { conditions: MedicalCondition[] }).conditions;

/**
 * المكتبة الكاملة = الأمراض العضلية/الهيكلية الأساسية + الحالات المرتبطة بالأعضاء.
 * نوسم الحالات المنتشرة (الفيبروميالجيا، ألم العضلات العام، تأخّر ظهور العضلات)
 * بـ diffuse حتى لا تطغى على الأسباب الموضعية.
 */
const DIFFUSE_IDS = new Set(['doid:1490', 'doid:8505', 'doid:8505-doms']);
const CONDITIONS: MedicalCondition[] = [...BASE_CONDITIONS, ...ORGAN_CONDITIONS].map((c) =>
  DIFFUSE_IDS.has(c.id) ? { ...c, diffuse: true } : c,
);
const SYMPTOMS = (symptomsData as { symptoms: MedicalSymptom[] }).symptoms;

/** ترجمة نص ثلاثي اللغة مع الرجوع للعربية. */
export function localize(value: LocalizedText, language: Language): string {
  return value[language] ?? value.ar;
}

/** كل الأمراض المتاحة (offline). */
export function getAllConditions(): MedicalCondition[] {
  return CONDITIONS;
}

/** كل الأعراض المتاحة (offline). */
export function getAllSymptoms(): MedicalSymptom[] {
  return SYMPTOMS;
}

/** جلب حالة مرضية بالمعرّف. */
export function getConditionById(id: string): MedicalCondition | null {
  return CONDITIONS.find((condition) => condition.id === id) ?? null;
}

/** جلب عرض بالمعرّف. */
export function getSymptomById(id: string): MedicalSymptom | null {
  return SYMPTOMS.find((symptom) => symptom.id === id) ?? null;
}

/**
 * الأمراض المرتبطة بمجموعة عضلات معيّنة.
 * مثال: "lower-back" -> ألم أسفل الظهر، الانزلاق الغضروفي القطني ...
 */
export function getConditionsByMuscleGroup(group: string): MedicalCondition[] {
  return CONDITIONS.filter((condition) => condition.muscleGroups.includes(group));
}

/**
 * الأمراض المرتبطة بمنطقة جسم معيّنة.
 * المناطق: back | head_neck | lower_limb | torso_front | upper_limb
 */
export function getConditionsByRegion(region: string): MedicalCondition[] {
  return CONDITIONS.filter((condition) => condition.regions.includes(region));
}

/** الأعراض المرتبطة بمنطقة جسم معيّنة. */
export function getSymptomsByRegion(region: string): MedicalSymptom[] {
  return SYMPTOMS.filter((symptom) => symptom.regions.includes(region));
}

/** الأعراض المرتبطة بحالة مرضية (عبر أكواد HPO). */
export function getSymptomsForCondition(condition: MedicalCondition): MedicalSymptom[] {
  return condition.symptoms
    .map((code) => SYMPTOMS.find((symptom) => symptom.id === code))
    .filter((x): x is MedicalSymptom => Boolean(x));
}

/** هل الحالة تحتوي على علامات خطر (red flags)؟ */
export function hasRedFlags(condition: MedicalCondition): boolean {
  const rf = condition.redFlags;
  return Boolean(rf && (rf.ar || rf.en || rf.fr));
}

/**
 * بحث نصي بسيط (offline) في أسماء وأوصاف الأمراض والأعراض.
 * يدعم العربية والإنجليزية والفرنسية.
 */
export function searchMedicalLibrary(query: string): {
  conditions: MedicalCondition[];
  symptoms: MedicalSymptom[];
} {
  const q = query.trim().toLowerCase();
  if (!q) return { conditions: [], symptoms: [] };

  const match = (text: LocalizedText) =>
    text.ar.toLowerCase().includes(q) ||
    text.en.toLowerCase().includes(q) ||
    text.fr.toLowerCase().includes(q);

  return {
    conditions: CONDITIONS.filter(
      (c) =>
        match(c.name) ||
        match(c.summary) ||
        c.doid.toLowerCase().includes(q) ||
        c.icd10.toLowerCase().includes(q)
    ),
    symptoms: SYMPTOMS.filter(
      (s) =>
        match(s.name) ||
        match(s.description) ||
        s.hpo.toLowerCase().includes(q)
    ),
  };
}

/** إحصائيات المكتبة المحلية. */
export function getLibraryStats() {
  const groups = new Set<string>();
  const regions = new Set<string>();
  CONDITIONS.forEach((c) => {
    c.muscleGroups.forEach((g) => groups.add(g));
    c.regions.forEach((r) => regions.add(r));
  });
  return {
    conditions: CONDITIONS.length,
    symptoms: SYMPTOMS.length,
    muscleGroups: groups.size,
    regions: regions.size,
  };
}
