import { useMemo } from 'react';
import svgMappingData from '../data/svgMuscleMapping.json';
import anatomyPainMap from '../data/anatomyPainMap.json';

// ============= الأنواع =============
export type Gender = 'male' | 'female';
export type Language = 'ar' | 'en' | 'fr';

export interface AnatomyPart {
  id: string;
  labelAr: string;
  labelEn: string;
  group: string;
  region: string;
  side: 'left' | 'right' | 'center';
  axis: string | null;
  gender: Gender;
  views: string[];
  commonCauses: string[];
  warning: string | null;
  recommendation: string;
  reviewStatus: string;
  partNumber: number;
  groupLabelAr: string;
  locationAr: string;
  medicalSafety: string;
}

export interface MuscleMapping {
  svgId: string;
  svgView: 'front' | 'back';
  anatomyMaleId: string;
  anatomyFemaleId: string;
  labelAr: string;
  labelEn: string;
  side: 'left' | 'right';
  group: string;
}

export interface LocalizedMuscleData {
  id: string;
  name: string;
  group: string;
  groupLabel: string;
  side: string;
  location: string;
  commonCauses: string[];
  warning: string | null;
  recommendation: string;
  requiresDoctor: boolean;
  medicalSafety: string;
  svgId: string;
  svgView: 'front' | 'back';
}

// ============= البيانات =============
const svgMapping = svgMappingData as { elements: MuscleMapping[] };
const anatomyData = anatomyPainMap as {
  muscles: Record<string, AnatomyPart>;
  groups: Record<string, { labelAr: string }>;
};

// ============= ترجمة النصوص =============
const TRANSLATIONS = {
  ar: {
    groupLabel: (g: string) => anatomyData.groups[g]?.labelAr || g,
    noData: 'لا توجد بيانات طبية لهذه المنطقة',
  },
  en: {
    groupLabel: (g: string) => g.replace(/-/g, ' '),
    noData: 'No medical data for this area',
  },
  fr: {
    groupLabel: (g: string) => g.replace(/-/g, ' '),
    noData: 'Aucune donnée médicale pour cette zone',
  },
};

// ============= الدالة الرئيسية =============
function findAnatomyPart(
  mapping: MuscleMapping,
  gender: Gender
): AnatomyPart | null {
  const id =
    gender === 'male' ? mapping.anatomyMaleId : mapping.anatomyFemaleId;

  // لو مفيش female، نرجع للـ male
  const fallbackId = mapping.anatomyMaleId;

  return (
    anatomyData.muscles[id] ||
    anatomyData.muscles[fallbackId] ||
    null
  );
}

function localizeMuscle(
  part: AnatomyPart,
  mapping: MuscleMapping,
  language: Language
): LocalizedMuscleData {
  const t = TRANSLATIONS[language];

  return {
    id: part.id,
    name: language === 'ar' ? part.labelAr : part.labelEn,
    group: part.group,
    groupLabel: t.groupLabel(part.group),
    side: part.side,
    location: part.locationAr,
    commonCauses: part.commonCauses,
    warning: part.warning,
    recommendation: part.recommendation,
    requiresDoctor: !!part.warning,
    medicalSafety: part.medicalSafety,
    svgId: mapping.svgId,
    svgView: mapping.svgView,
  };
}

// ============= الـ Hooks =============

/**
 * Hook رئيسي: يجيب بيانات طبية من SVG ID
 */
export function useMuscleMedicalData(
  svgId: string | null,
  gender: Gender = 'male',
  language: Language = 'ar'
): LocalizedMuscleData | null {
  return useMemo(() => {
    if (!svgId) return null;

    const mapping = svgMapping.elements.find((el) => el.svgId === svgId);
    if (!mapping) return null;

    const part = findAnatomyPart(mapping, gender);
    if (!part) return null;

    return localizeMuscle(part, mapping, language);
  }, [svgId, gender, language]);
}

/**
 * Hook: يجيب كل العضلات لمنظر معين (front/back)
 */
export function useMusclesByView(
  view: 'front' | 'back',
  gender: Gender = 'male',
  language: Language = 'ar'
): LocalizedMuscleData[] {
  return useMemo(() => {
    return svgMapping.elements
      .filter((el) => el.svgView === view)
      .map((mapping) => {
        const part = findAnatomyPart(mapping, gender);
        if (!part) return null;
        return localizeMuscle(part, mapping, language);
      })
      .filter((x): x is LocalizedMuscleData => x !== null);
  }, [view, gender, language]);
}

/**
 * Hook: يجيب كل العضلات
 */
export function useAllMuscles(
  gender: Gender = 'male',
  language: Language = 'ar'
): LocalizedMuscleData[] {
  return useMemo(() => {
    return svgMapping.elements
      .map((mapping) => {
        const part = findAnatomyPart(mapping, gender);
        if (!part) return null;
        return localizeMuscle(part, mapping, language);
      })
      .filter((x): x is LocalizedMuscleData => x !== null);
  }, [gender, language]);
}

/**
 * Hook: يجيب العضلات حسب المجموعة
 */
export function useMusclesByGroup(
  group: string,
  gender: Gender = 'male',
  language: Language = 'ar'
): LocalizedMuscleData[] {
  return useMemo(() => {
    return svgMapping.elements
      .filter((el) => el.group === group)
      .map((mapping) => {
        const part = findAnatomyPart(mapping, gender);
        if (!part) return null;
        return localizeMuscle(part, mapping, language);
      })
      .filter((x): x is LocalizedMuscleData => x !== null);
  }, [group, gender, language]);
}

/**
 * Hook: يجيب العضلات اللي محتاجة دكتور
 */
export function useCriticalMuscles(
  gender: Gender = 'male',
  language: Language = 'ar'
): LocalizedMuscleData[] {
  return useMemo(() => {
    return svgMapping.elements
      .map((mapping) => {
        const part = findAnatomyPart(mapping, gender);
        if (!part || !part.warning) return null;
        return localizeMuscle(part, mapping, language);
      })
      .filter((x): x is LocalizedMuscleData => x !== null);
  }, [gender, language]);
}

/**
 * Hook: إحصائيات
 */
export function useMedicalDataStats() {
  return useMemo(() => {
    const totalMapped = svgMapping.elements.length;
    const frontCount = svgMapping.elements.filter(
      (e) => e.svgView === 'front'
    ).length;
    const backCount = svgMapping.elements.filter(
      (e) => e.svgView === 'back'
    ).length;
    const groups = new Set(svgMapping.elements.map((e) => e.group));

    return {
      totalMapped,
      frontCount,
      backCount,
      groupsCount: groups.size,
      groups: Array.from(groups),
    };
  }, []);
}
