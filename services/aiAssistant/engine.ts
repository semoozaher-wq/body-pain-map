// services/aiAssistant/engine.ts
// ============================================================================
// محرّك المساعد الذكي المحلي (Offline AI Engine)
// ----------------------------------------------------------------------------
// يفهم جملة المستخدم الحرة (عربي / إنجليزي / فرنسي) ويحوّلها إلى رد إرشادي:
//   1) تطبيع النص (إزالة التشكيل، توحيد الهمزات، تصغير الحروف اللاتينية).
//   2) استخراج: مناطق الجسم + الأعراض + علامات الإنذار + الشدّة + المدة.
//   3) حساب درجة الاستعجال (فرز إرشادي) مع مراعاة علامات الخطر.
//   4) مطابقة أمراض محتملة من المكتبة الطبية المحلية (diseaseLibrary) بترتيب
//      حسب درجة التطابق.
//   5) توليد نصائح رعاية ذاتية عامة/حسب المنطقة + متى تطلب المساعدة.
//
// ⚠️ لا يقدّم تشخيصًا ولا قرارًا علاجيًا — إرشاد تعليمي فقط. كل شيء محلي.
// ============================================================================

import { getAllConditions, localize, type MedicalCondition } from '../medical/diseaseLibrary';
import organDetailsData from '../../data/organDetails.json';
import {
  ABDOMEN_LOCATIONS,
  BODY_REGIONS,
  DURATION_WORDS,
  NEGATION_WORDS,
  ORGAN_TERMS,
  RED_FLAG_TERMS,
  SEVERITY_WORDS,
  SYMPTOM_TERMS,
  type AbdomenLocation,
  type BodyRegionKey,
  type Lang,
  type LocalizedText,
  type OrganTerm,
  type RegionTerm,
  type SymptomTerm,
} from './lexicon';

/** تفاصيل عضو داخلي غنية (من organDetails.json) — المحتوى عربي كما في التطبيق. */
interface OrganDetailRaw {
  name: string;
  location?: string;
  visualHint?: string;
  symptoms?: string[];
  causes?: string[];
  warning?: string;
  recommendation?: string;
}
const ORGAN_DETAILS = organDetailsData as unknown as Record<string, OrganDetailRaw>;

export type TriageLevel = 'self_care' | 'routine' | 'soon' | 'urgent' | 'emergency';

export interface DetectedRegion {
  id: string;
  region: BodyRegionKey;
  label: LocalizedText;
}

export interface DetectedOrgan {
  id: string;
  region: BodyRegionKey;
  /** هل للعضو نقطة على خريطة الأعضاء (يمكن فتحه)؟ */
  onMap: boolean;
  label: LocalizedText;
  blurb: LocalizedText;
}

export interface DetectedOrganDetail {
  id: string;
  label: LocalizedText;
  blurb: LocalizedText;
  location?: string;
  symptoms?: string[];
  causes?: string[];
  warning?: string;
  recommendation?: string;
}

/** موضع دقيق داخل البطن تمّ التعرّف عليه (مثل «أسفل يسار البطن»). */
export interface DetectedLocation {
  id: string;
  label: LocalizedText;
  /** أعضاء مرشّحة لهذا الموضع. */
  organs: string[];
  /** مناطق الجسم المرتبطة. */
  regions: string[];
}

export interface DetectedSymptom {
  id: string;
  label: LocalizedText;
  redFlag: boolean;
  /** عرض عام (كلمة «وجع» وحدها) لا يرفّح أي مرض محدّد. */
  generic: boolean;
}

export interface DetectedRedFlag {
  id: string;
  level: 'emergency' | 'urgent';
  label: LocalizedText;
}

export interface ConditionMatch {
  id: string;
  name: LocalizedText;
  summary: LocalizedText;
  icd10: string;
  medlinePlusUrl: string;
  score: number;
}

export interface TriageAssessment {
  level: TriageLevel;
  title: LocalizedText;
  advice: LocalizedText;
}

export interface AssistantReply {
  /** مقدّمة تعاطفية. */
  intro: LocalizedText;
  /** عناصر فهم ما قاله المستخدم (جاهزة للعرض). */
  understanding: string[];
  /** هل فُهمت جملة ذات معنى؟ إن لا نطلب توضيحًا. */
  understood: boolean;
  /** سؤال توضيحي عند غياب التفاصيل. */
  clarifyingQuestion: LocalizedText | null;
  triage: TriageAssessment;
  redFlags: DetectedRedFlag[];
  regions: DetectedRegion[];
  symptoms: DetectedSymptom[];
  /** الأعضاء الداخلية التي ذكرها المستخدم. */
  organs: DetectedOrgan[];
  /** المواضع الدقيقة داخل البطن (أرباع/جهات) التي ذُكرت. */
  locations: DetectedLocation[];
  /** تفاصيل غنية للأعضاء المتوفّرة في organDetails.json. */
  organDetails: DetectedOrganDetail[];
  conditions: ConditionMatch[];
  selfCare: string[];
  whenToSeeDoctor: LocalizedText;
  suggestedRegionId: string | null;
  suggestedRegionLabel: LocalizedText | null;
  /** العضو المقترح لفتحه على خريطة الأعضاء (إن وُجدت نقطة له). */
  suggestedOrganId: string | null;
  suggestedOrganLabel: LocalizedText | null;
  disclaimer: LocalizedText;
  /** اللغة التي طُلبت بها الإجابة (لتُعرض الحقول متعددة اللغات). */
  __lang: Lang;
}

// ---------------------------------------------------------------------------
// تطبيع النص
// ---------------------------------------------------------------------------
const AR_DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g; // تشكيل + تطويل

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(AR_DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ئ/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsKeyword(haystack: string, keyword: string): boolean {
  const needle = normalize(keyword);
  if (!needle) return false;
  return haystack.includes(needle);
}

function matchAny(text: string, keywords: Record<Lang, string[]>): boolean {
  return [...keywords.ar, ...keywords.en, ...keywords.fr].some((k) => containsKeyword(text, k));
}

/** هل الكلمة مسبوقة بنفي؟ (نافذة 16 حرفًا قبلها، مع مطابقة حدود الكلمات لتجنّب أخطاء مثل «مش» داخل «مشكلة»). */
function isNegated(text: string, keyword: string): boolean {
  const needle = normalize(keyword);
  const idx = text.indexOf(needle);
  if (idx <= 0) return false;
  const before = ` ${text.slice(Math.max(0, idx - 16), idx)} `;
  return [...NEGATION_WORDS.ar, ...NEGATION_WORDS.en, ...NEGATION_WORDS.fr].some((n) => {
    const neg = normalize(n);
    return before.includes(` ${neg} `);
  });
}

// ---------------------------------------------------------------------------
// الاستخراج
// ---------------------------------------------------------------------------
export function detectRegions(text: string): DetectedRegion[] {
  const found = new Map<string, DetectedRegion>();
  BODY_REGIONS.forEach((region) => {
    const hit = [...region.keywords.ar, ...region.keywords.en, ...region.keywords.fr].find((k) =>
      containsKeyword(text, k),
    );
    if (hit && !isNegated(text, hit)) {
      found.set(region.id, { id: region.id, region: region.region, label: region.label });
    }
  });
  return [...found.values()];
}

export function detectOrgans(text: string): DetectedOrgan[] {
  const found = new Map<string, DetectedOrgan>();
  ORGAN_TERMS.forEach((organ: OrganTerm) => {
    const hit = [...organ.keywords.ar, ...organ.keywords.en, ...organ.keywords.fr].find((k) =>
      containsKeyword(text, k),
    );
    if (hit && !isNegated(text, hit)) {
      found.set(organ.id, {
        id: organ.id,
        region: organ.region,
        onMap: organ.onMap,
        label: organ.label,
        blurb: organ.blurb,
      });
    }
  });
  return [...found.values()];
}

export function detectSymptoms(text: string): DetectedSymptom[] {
  const found = new Map<string, DetectedSymptom>();
  SYMPTOM_TERMS.forEach((symptom) => {
    const hit = [...symptom.keywords.ar, ...symptom.keywords.en, ...symptom.keywords.fr].find((k) =>
      containsKeyword(text, k),
    );
    if (hit && !isNegated(text, hit)) {
      found.set(symptom.id, {
        id: symptom.id,
        label: symptom.label,
        redFlag: symptom.redFlag,
        generic: symptom.generic === true,
      });
    }
  });
  return [...found.values()];
}

/** مواضع دقيقة داخل البطن (أرباع/جهات بالنسبة للسرة). */
export function detectLocations(text: string): DetectedLocation[] {
  const found = new Map<string, DetectedLocation>();
  ABDOMEN_LOCATIONS.forEach((loc: AbdomenLocation) => {
    const hit = [...loc.keywords.ar, ...loc.keywords.en, ...loc.keywords.fr].find((k) =>
      containsKeyword(text, k),
    );
    if (hit && !isNegated(text, hit)) {
      found.set(loc.id, { id: loc.id, label: loc.label, organs: loc.organs, regions: loc.regions });
    }
  });
  return [...found.values()];
}

/** يدمج الأعضاء المذكورة صراحةً مع الأعضاء المرشّحة من المواضع الدقيقة. */
function mergeLocationOrgans(organs: DetectedOrgan[], locations: DetectedLocation[]): DetectedOrgan[] {
  const byId = new Map<string, DetectedOrgan>();
  organs.forEach((o) => byId.set(o.id, o));
  locations.forEach((loc) => {
    loc.organs.forEach((id) => {
      if (byId.has(id)) return;
      const term = ORGAN_TERMS.find((t) => t.id === id);
      if (term) {
        byId.set(id, {
          id: term.id,
          region: term.region,
          onMap: term.onMap,
          label: term.label,
          blurb: term.blurb,
        });
      }
    });
  });
  return [...byId.values()];
}

export function detectRedFlags(text: string): DetectedRedFlag[] {
  const found = new Map<string, DetectedRedFlag>();
  RED_FLAG_TERMS.forEach((flag) => {
    if (matchAny(text, flag.keywords)) {
      found.set(flag.id, { id: flag.id, level: flag.level, label: flag.label });
    }
  });
  return [...found.values()];
}

/** شدّة 0..10 من الأرقام أو الكلمات. */
export function detectSeverity(text: string): number | null {
  // كلمات تدل على المدة أو العدد (لا تمثّل شدّة الألم) — بعد تطبيع النص.
  const NON_SEVERITY = new Set<string>([
    'يوم', 'ايام', 'ساعه', 'ساعات', 'اسبوع', 'اسابيع', 'شهر', 'شهور', 'دقيقه', 'دقايق',
    'سنه', 'سنين', 'عام', 'اعوام', 'مره', 'مرات', 'منطقه', 'مناطق', 'مكان', 'اماكن', 'موضع', 'مواضع',
    'يومين', 'ساعتين', 'اسبوعين', 'شهرين',
  ]);
  const tokens = text.split(/\s+/).filter(Boolean);
  for (let i = 0; i < tokens.length; i += 1) {
    const m = tokens[i].match(/^(\d{1,2})(?:\/10)?$/);
    if (!m) continue;
    const value = Number(m[1]);
    if (value < 0 || value > 10) continue;
    const prev = tokens[i - 1] ?? '';
    const next = tokens[i + 1] ?? '';
    const tiedToQuantity = [prev, next].some((word) => NON_SEVERITY.has(word.replace(/^و/, '')));
    if (tiedToQuantity) continue;
    return value;
  }
  if (matchAny(text, SEVERITY_WORDS.severe)) return 8;
  if (matchAny(text, SEVERITY_WORDS.moderate)) return 5;
  if (matchAny(text, SEVERITY_WORDS.mild)) return 3;
  return null;
}

/** المدة (وحدة تقريبية). */
export function detectDuration(text: string): keyof typeof DURATION_WORDS | null {
  if (matchAny(text, DURATION_WORDS.months)) return 'months';
  if (matchAny(text, DURATION_WORDS.weeks)) return 'weeks';
  if (matchAny(text, DURATION_WORDS.days)) return 'days';
  if (matchAny(text, DURATION_WORDS.hours)) return 'hours';
  return null;
}

// ---------------------------------------------------------------------------
// مطابقة الأمراض المحتملة
// ---------------------------------------------------------------------------
const symBase = (id: string) => id.replace(/[^0-9]+$/, '');

/**
 * أوزان الأعضاء المرشّحة: العضو الأول في الموضع (أو العضو المذكور صراحةً)
 * يأخذ وزنًا أعلى من الأعضاء الثانوية، حتى يفوز السبب الموضعي الأرجح.
 */
function buildOrganWeights(organs: DetectedOrgan[], locations: DetectedLocation[]): Map<string, number> {
  const weights = new Map<string, number>();
  const bump = (id: string, w: number) => weights.set(id, Math.max(weights.get(id) ?? 0, w));
  organs.forEach((o) => bump(o.id, 6)); // ذكر العضو صراحةً = إشارة قوية
  locations.forEach((loc) => {
    loc.organs.forEach((id, index) => bump(id, index === 0 ? 6 : 3));
  });
  return weights;
}

export function scoreConditions(
  regions: DetectedRegion[],
  symptoms: DetectedSymptom[],
  organs: DetectedOrgan[] = [],
  locations: DetectedLocation[] = [],
): ConditionMatch[] {
  // الأعراض العامة (كلمة «وجع» وحدها) لا تُرجّح أي مرض محدّد.
  const specificSymptoms = symptoms.filter((s) => !s.generic);
  const symptomBases = new Set(specificSymptoms.map((s) => symBase(s.id)));
  const organWeights = buildOrganWeights(organs, locations);
  const localized = organs.length > 0 || locations.length > 0;
  const scored: ConditionMatch[] = [];

  getAllConditions().forEach((condition: MedicalCondition) => {
    let score = 0;
    regions.forEach((region) => {
      if (condition.regions.includes(region.region)) score += 2;
      if (condition.muscleGroups.includes(region.id)) score += 2;
    });
    organs.forEach((organ) => {
      if (condition.regions.includes(organ.region)) score += 1;
    });
    // مطابقة عضو مرشّح = إشارة قوية (الأعضاء الأرجح أولًا).
    if (condition.organs) {
      condition.organs.forEach((oid) => {
        const w = organWeights.get(oid);
        if (w) score += w;
      });
    }
    condition.symptoms.forEach((sid) => {
      if (symptomBases.has(symBase(sid))) score += 3;
    });

    // الحالات المنتشرة (فيبروميالجيا/ألم عضلي عام) لا تُرجّح عند شكوى موضعية واحدة.
    if (condition.diffuse) {
      if (localized) score -= 5;
      if (regions.length <= 1 && organs.length === 0) score -= 3;
    }

    if (score > 0) {
      scored.push({
        id: condition.id,
        name: condition.name,
        summary: condition.summary,
        icd10: condition.icd10,
        medlinePlusUrl: condition.medlinePlusUrl,
        score,
      });
    }
  });

  return scored.sort((a, b) => b.score - a.score).slice(0, 4);
}

// ---------------------------------------------------------------------------
// الفرز الإرشادي
// ---------------------------------------------------------------------------
// ترتيب مستويات الفرز من الأخفّ إلى الأشدّ (لرفع الدرجة عند الحاجة).
const TRIAGE_ORDER: TriageLevel[] = ['self_care', 'routine', 'soon', 'urgent', 'emergency'];

// الحدّ الأدنى لدرجة الفرز حسب العضو (أعضاء حرجة تستدعي انتباهًا أكبر).
const ORGAN_TRIAGE_FLOOR: Partial<Record<string, TriageLevel>> = {
  heart: 'soon',
  lungs: 'routine',
  kidneys: 'routine',
  appendix: 'soon',
  pancreas: 'soon',
  gallbladder: 'routine',
};

/** عنوان ونصيحة كل مستوى فرز. */
const TRIAGE_META: Record<TriageLevel, { title: LocalizedText; advice: LocalizedText }> = {
  self_care: {
    title: { ar: 'رعاية ذاتية ومتابعة', en: 'Self-care and monitoring', fr: 'Auto-soins et surveillance' },
    advice: {
      ar: 'غالبًا يمكن التعامل معه بالرعاية الذاتية، مع مراقبة الأعراض وطلب المساعدة لو تغيّرت.',
      en: 'Likely manageable with self-care, while monitoring symptoms and seeking help if they change.',
      fr: 'Généralement gérable par l’auto-soin, en surveillant et en consultant si ça change.',
    },
  },
  routine: {
    title: { ar: 'متابعة روتينية', en: 'Routine follow-up', fr: 'Suivi de routine' },
    advice: {
      ar: 'لو الألم مستمر أو متكرر، يفضّل استشارة طبيب لتقييم السبب ووضع خطة مناسبة.',
      en: 'If the pain persists or recurs, consider seeing a doctor to assess the cause and plan.',
      fr: 'Si la douleur persiste ou revient, consultez un médecin pour évaluer la cause.',
    },
  },
  soon: {
    title: { ar: 'يُستحسن مراجعة طبيب قريبًا', en: 'See a doctor soon', fr: 'Consultez bientôt' },
    advice: {
      ar: 'الشدّة عالية نسبيًا. رتّب موعدًا مع طبيب خلال يوم أو يومين، وتابع تطوّر الألم.',
      en: 'The intensity is fairly high. Arrange a doctor visit within a day or two and track the pain.',
      fr: 'L’intensité est assez élevée. Prenez rendez-vous sous un ou deux jours et suivez l’évolution.',
    },
  },
  urgent: {
    title: { ar: 'تقييم عاجل خلال ساعات', en: 'Urgent — evaluate within hours', fr: 'Urgent — évaluation dans les heures' },
    advice: {
      ar: 'الأفضل تتواصل مع طبيب أو عيادة عاجلة في أسرع وقت، ولو زادت الأعراض روح الطوارئ.',
      en: 'Best to contact a doctor or urgent-care clinic soon; if symptoms worsen, go to the ER.',
      fr: 'Il vaut mieux consulter un médecin ou une clinique sans tarder ; si ça s’aggrave, allez aux urgences.',
    },
  },
  emergency: {
    title: { ar: 'طوارئ — اطلب المساعدة فورًا', en: 'Emergency — seek help now', fr: 'Urgence — demandez de l’aide maintenant' },
    advice: {
      ar: 'العلامات اللي ذكرتها قد تكون خطرة. أوقف أي مجهود واتصل بخدمات الطوارئ المحلية أو روح أقرب مستشفى حالًا.',
      en: 'The signs you mentioned may be dangerous. Stop any activity and call local emergency services or go to the nearest ER now.',
      fr: 'Les signes mentionnés peuvent être dangereux. Arrêtez toute activité et appelez les urgences ou allez aux urgences maintenant.',
    },
  },
};

/** الفرز الأساسي قبل تطبيق حدّ العضو. */
function assessTriageBase(
  redFlags: DetectedRedFlag[],
  severity: number | null,
  duration: keyof typeof DURATION_WORDS | null,
  regions: DetectedRegion[],
  symptoms: DetectedSymptom[],
): TriageAssessment {
  const hasEmergency = redFlags.some((f) => f.level === 'emergency');
  const hasUrgent = redFlags.some((f) => f.level === 'urgent');
  const redFlagSymptom = symptoms.some((s) => s.redFlag);

  if (hasEmergency) {
    return {
      level: 'emergency',
      title: { ar: 'طوارئ — اطلب المساعدة فورًا', en: 'Emergency — seek help now', fr: 'Urgence — demandez de l’aide maintenant' },
      advice: {
        ar: 'العلامات اللي ذكرتها قد تكون خطرة. أوقف أي مجهود واتصل بخدمات الطوارئ المحلية أو روح أقرب مستشفى حالًا.',
        en: 'The signs you mentioned may be dangerous. Stop any activity and call local emergency services or go to the nearest ER now.',
        fr: 'Les signes mentionnés peuvent être dangereux. Arrêtez toute activité et appelez les urgences ou allez aux urgences maintenant.',
      },
    };
  }
  if (hasUrgent || redFlagSymptom || (severity !== null && severity >= 9)) {
    return {
      level: 'urgent',
      title: { ar: 'تقييم عاجل خلال ساعات', en: 'Urgent — evaluate within hours', fr: 'Urgent — évaluation dans les heures' },
      advice: {
        ar: 'الأفضل تتواصل مع طبيب أو عيادة عاجلة في أسرع وقت، ولو زادت الأعراض روح الطوارئ.',
        en: 'Best to contact a doctor or urgent-care clinic soon; if symptoms worsen, go to the ER.',
        fr: 'Il vaut mieux consulter un médecin ou une clinique sans tarder ; si ça s’aggrave, allez aux urgences.',
      },
    };
  }
  if (severity !== null && severity >= 7) {
    return {
      level: 'soon',
      title: { ar: 'يُستحسن مراجعة طبيب قريبًا', en: 'See a doctor soon', fr: 'Consultez bientôt' },
      advice: {
        ar: 'الشدّة عالية نسبيًا. رتّب موعدًا مع طبيب خلال يوم أو يومين، وتابع تطوّر الألم.',
        en: 'The intensity is fairly high. Arrange a doctor visit within a day or two and track the pain.',
        fr: 'L’intensité est assez élevée. Prenez rendez-vous sous un ou deux jours et suivez l’évolution.',
      },
    };
  }
  if (duration === 'weeks' || duration === 'months' || regions.length >= 2) {
    return {
      level: 'routine',
      title: { ar: 'متابعة روتينية', en: 'Routine follow-up', fr: 'Suivi de routine' },
      advice: {
        ar: 'لو الألم مستمر أو متكرر، يفضّل استشارة طبيب لتقييم السبب ووضع خطة مناسبة.',
        en: 'If the pain persists or recurs, consider seeing a doctor to assess the cause and plan.',
        fr: 'Si la douleur persiste ou revient, consultez un médecin pour évaluer la cause.',
      },
    };
  }
  return {
    level: 'self_care',
    title: { ar: 'رعاية ذاتية ومتابعة', en: 'Self-care and monitoring', fr: 'Auto-soins et surveillance' },
    advice: {
      ar: 'غالبًا يمكن التعامل معه بالرعاية الذاتية، مع مراقبة الأعراض وطلب المساعدة لو تغيّرت.',
      en: 'Likely manageable with self-care, while monitoring symptoms and seeking help if they change.',
      fr: 'Généralement gérable par l’auto-soin, en surveillant et en consultant si ça change.',
    },
  };
}

// ---------------------------------------------------------------------------
// نصائح الرعاية الذاتية
// ---------------------------------------------------------------------------
/** الفرز النهائي مع مراعاة العضو (رفع الحدّ الأدنى للأعضاء الحرجة). */
function assessTriage(
  redFlags: DetectedRedFlag[],
  severity: number | null,
  duration: keyof typeof DURATION_WORDS | null,
  regions: DetectedRegion[],
  symptoms: DetectedSymptom[],
  organs: DetectedOrgan[] = [],
): TriageAssessment {
  const base = assessTriageBase(redFlags, severity, duration, regions, symptoms);
  let floorIdx = -1;
  organs.forEach((organ) => {
    const floor = ORGAN_TRIAGE_FLOOR[organ.id];
    if (floor) floorIdx = Math.max(floorIdx, TRIAGE_ORDER.indexOf(floor));
  });
  if (floorIdx > TRIAGE_ORDER.indexOf(base.level)) {
    const level = TRIAGE_ORDER[floorIdx];
    return { level, ...TRIAGE_META[level] };
  }
  return base;
}

/** نصيحة سلامة عامة تُضاف دائمًا (لا تبدأ دواء من عندك). */
const SELF_CARE_SAFETY: LocalizedText = {
  ar: 'لا تبدأ أدوية أو جرعات من عندك — استشر صيدلي أو طبيب.',
  en: 'Do not self-prescribe medicines or doses — ask a pharmacist or doctor.',
  fr: 'Ne prenez pas de médicaments de vous-même — demandez à un pharmacien ou médecin.',
};

/** نصائح عامة (تُستخدم كملء فقط بعد النصائح المرتبطة بالعضو/المرض). */
const SELF_CARE_GENERAL: LocalizedText[] = [
  { ar: 'ارتاح بشكل نسبي وتجنّب الراحة الطويلة تمامًا — الحركة اللطيفة غالبًا أفضل.', en: 'Rest relatively; avoid total prolonged rest — gentle movement is often better.', fr: 'Reposez-vous relativement ; évitez le repos total prolongé — le mouvement doux aide souvent.' },
  { ar: 'استخدم كمادة دافئة أو باردة حسب ما يريحك (دافئة للشد العضلي، باردة للتورم).', en: 'Use a warm or cold compress as it suits you (warm for muscle strain, cold for swelling).', fr: 'Compresse chaude ou froide selon ce qui soulage (chaude pour la contracture, froide pour le gonflement).' },
  { ar: 'اشرب ماء كفاية ونم جيدًا؛ قلة النوم تزيد الإحساس بالألم.', en: 'Stay hydrated and sleep well; poor sleep increases pain perception.', fr: 'Hydratez-vous et dormez bien ; le manque de sommeil augmente la douleur.' },
];

const SELF_CARE_BY_REGION: Record<string, LocalizedText[]> = {
  'lower-back': [
    { ar: 'تجنّب حمل الأوزان الثقيلة وارفعها بحركة صحيحة (بالرجلين لا بالظهر).', en: 'Avoid heavy lifting; lift with your legs, not your back.', fr: 'Évitez de porter lourd ; soulevez avec les jambes, pas le dos.' },
    { ar: 'تمارين تمدد لطيفة لأسفل الظهر والحوض عند الراحة.', en: 'Gentle stretching for the lower back and hips when comfortable.', fr: 'Étirements doux du bas du dos et des hanches.' },
  ],
  neck: [
    { ar: 'عدّل وضعية الجلوس والشاشة بمستوى النظر، وخد فترات راحة من الجلوس.', en: 'Adjust sitting posture and screen height; take breaks from sitting.', fr: 'Ajustez la posture et l’écran ; faites des pauses.' },
    { ar: 'تمارين تمدد لطيفة للرقبة والكتفين بدون شدّ عنيف.', en: 'Gentle neck and shoulder stretches without forceful pulling.', fr: 'Étirements doux du cou et des épaules.' },
  ],
  knees: [
    { ar: 'قلّل الحمل على الركبة وارفعها عند التورم، واستخدم كمادة باردة.', en: 'Reduce load on the knee, elevate if swollen, use a cold compress.', fr: 'Réduisez la charge, surélevez si gonflé, compresse froide.' },
  ],
  'upper-back': [
    { ar: 'حسّن وضعية الجلوس وتجنّب الانحناء الطويل على الموبايل أو اللابتوب.', en: 'Improve posture; avoid long hunching over phone or laptop.', fr: 'Améliorez la posture ; évitez de rester courbé longtemps.' },
  ],
};

const SELF_CARE_BY_ORGAN: Record<string, LocalizedText[]> = {
  heart: [
    {
      ar: 'لو ألم الصدر مستمر أو متكرر ما تهملوش — راجع طبيب، واطلب الطوارئ فورًا لو فيه ضيق نفس أو تعرّق أو ألم يمتد للذراع.',
      en: 'If chest pain is ongoing or recurrent, do not ignore it — see a doctor, and call emergency services if there is shortness of breath, sweating, or pain spreading to the arm.',
      fr: 'Si la douleur thoracique persiste ou revient, ne l’ignorez pas — consultez, et appelez les urgences en cas d’essoufflement, de sueurs ou de douleur irradiant au bras.',
    },
  ],
  lungs: [
    {
      ar: 'تجنّب التدخين والأماكن الملوّثة، وخد فترات راحة لو حسّيت بضيق نفس.',
      en: 'Avoid smoking and polluted places; rest if you feel short of breath.',
      fr: 'Évitez le tabac et les lieux pollués ; reposez-vous en cas d’essoufflement.',
    },
  ],
  stomach: [
    {
      ar: 'قلّل الأكل الحارّ والدسم والكافيين، وكُل وجبات صغيرة متكرّرة.',
      en: 'Reduce spicy, fatty food and caffeine; eat small frequent meals.',
      fr: 'Réduisez les aliments épicés, gras et la caféine ; mangez de petits repas fréquents.',
    },
  ],
  liver: [
    {
      ar: 'قلّل الدهون والكحول، واشرب ماء كفاية، وراجع طبيب لو استمر الألم أو ظهر اصفرار.',
      en: 'Reduce fats and alcohol, stay hydrated, and see a doctor if pain persists or jaundice appears.',
      fr: 'Réduisez les graisses et l’alcool, hydratez-vous, consultez si la douleur persiste ou en cas de jaunisse.',
    },
  ],
  kidneys: [
    {
      ar: 'اشرب ماء كفاية، وقلّل الملح، وراجع طبيب فورًا لو ظهر دم في البول أو حرارة.',
      en: 'Drink enough water, reduce salt, and see a doctor promptly if there is blood in urine or fever.',
      fr: 'Buvez assez d’eau, réduisez le sel, consultez vite en cas de sang dans les urines ou de fièvre.',
    },
  ],
  intestines: [
    {
      ar: 'اهتم بالألياف والماء، وتجنّب الأكل اللي بيزعّج قولونك، وراقب أي تغيّر في الإخراج.',
      en: 'Focus on fibre and fluids, avoid foods that upset your bowel, and watch for changes in bowel habits.',
      fr: 'Privilégiez fibres et eau, évitez les aliments irritants, surveillez les changements de transit.',
    },
  ],
  bladder: [
    {
      ar: 'اشرب ماء كفاية، وما تحبسش البول، وراجع طبيب لو فيه حرقان أو دم.',
      en: 'Drink enough water, do not hold urine, and see a doctor if there is burning or blood.',
      fr: 'Buvez assez d’eau, ne retenez pas l’urine, consultez en cas de brûlure ou de sang.',
    },
  ],
  uterus: [
    {
      ar: 'تابع الألم مع الدورة، واستخدم كمادات دافئة، وراجع طبيب لو الألم شديد أو النزيف غير طبيعي.',
      en: 'Track pain with your cycle, use warm compresses, and see a doctor if pain is severe or bleeding is abnormal.',
      fr: 'Suivez la douleur selon le cycle, compresses chaudes, consultez si douleur intense ou saignement anormal.',
    },
  ],
  ovaries: [
    {
      ar: 'لو الألم في أسفل البطن مرتبط بالدورة أو مصحوب بأعراض تانية، الأفضل مراجعة طبيب نساء.',
      en: 'If lower-abdominal pain is tied to your cycle or has other symptoms, consider seeing a gynaecologist.',
      fr: 'Si la douleur du bas-ventre est liée au cycle ou accompagnée d’autres signes, consultez un gynécologue.',
    },
  ],
  thyroid: [
    {
      ar: 'راقب أي تغيّر في الوزن أو النبض أو الحرارة، وراجع طبيب لعمل تحاليل الغدة.',
      en: 'Watch for changes in weight, heart rate, or temperature, and see a doctor for thyroid tests.',
      fr: 'Surveillez les changements de poids, de pouls ou de température, consultez pour des tests thyroïdiens.',
    },
  ],
  gallbladder: [
    {
      ar: 'قلّل الأكل الدسم جدًا والوجبات الكبيرة، وكُل وجبات صغيرة منتظمة، وراقب الألم بعد الأكل الدسم.',
      en: 'Reduce very fatty foods and large meals; eat small regular meals and watch pain after fatty food.',
      fr: 'Réduisez les aliments très gras et les gros repas ; mangez de petits repas réguliers.',
    },
  ],
  pancreas: [
    {
      ar: 'امتنع عن الكحول تمامًا وقلّل الأكل الدسم، واشرب سوائل، وراجع طبيب فورًا لو الألم شديد أو ينتقل للظهر.',
      en: 'Avoid alcohol completely, reduce fatty food, keep fluids up, and see a doctor promptly if pain is severe or radiates to the back.',
      fr: 'Évitez totalement l’alcool, réduisez les graisses, buvez, consultez vite si la douleur est intense ou irradie au dos.',
    },
  ],
  appendix: [
    {
      ar: 'لا تأكل أو تشرب شيئًا قبل التقييم الطبي، ولا تستخدم مسكنات تخفي الأعراض، وتوجّه للطوارئ لو الألم زاد أو صاحبته حرارة.',
      en: 'Do not eat or drink before medical assessment, avoid painkillers that mask symptoms, and go to the ER if pain worsens or fever appears.',
      fr: 'Ne mangez ni ne buvez avant l’évaluation, évitez les antidouleurs qui masquent les signes, allez aux urgences si la douleur s’aggrave ou fièvre.',
    },
  ],
  esophagus: [
    {
      ar: 'تجنّب الأكل قبل النوم بساعتين، وارفع رأس السرير، وقلّل الكافيين والدهون والبهارات.',
      en: 'Avoid eating within two hours of bedtime, raise the head of the bed, and reduce caffeine, fat, and spices.',
      fr: 'Évitez de manger deux heures avant le coucher, surélevez la tête du lit, réduisez caféine, graisses et épices.',
    },
  ],
};

/** نصائح مرتبطة بالمرض الأرجح (تظهر أولًا وتختلف حسب الحالة). */
const SELF_CARE_BY_CONDITION: Record<string, LocalizedText[]> = {
  'doid:appendicitis': [
    {
      ar: 'لو الألم انتقل لأسفل يمين البطن مع حرارة أو قيء، دي علامة تستدعي الطوارئ فورًا — متأخّرش.',
      en: 'If pain moves to the lower-right abdomen with fever or vomiting, that needs emergency care now — do not delay.',
      fr: 'Si la douleur migre en bas à droite avec fièvre ou vomissements, c’est une urgence — n’attendez pas.',
    },
  ],
  'doid:gastritis': [
    {
      ar: 'قلّل الأكل الحار والدسم والكافيين، وكُل وجبات صغيرة متكرّرة، وتجنّب المسكنات (NSAID) بدون استشارة.',
      en: 'Reduce spicy/fatty food and caffeine, eat small frequent meals, and avoid NSAID painkillers without advice.',
      fr: 'Réduisez épicés, gras et caféine, mangez de petits repas fréquents, évitez les AINS sans avis.',
    },
  ],
  'doid:peptic-ulcer': [
    {
      ar: 'تجنّب المسكنات (NSAID) والكحول والتدخين، وكُل وجبات صغيرة، وراجع طبيب لو استمر الحرقان.',
      en: 'Avoid NSAIDs, alcohol, and smoking, eat small meals, and see a doctor if burning persists.',
      fr: 'Évitez les AINS, l’alcool et le tabac, mangez peu à la fois, consultez si la brûlure persiste.',
    },
  ],
  'doid:ibs': [
    {
      ar: 'راقب الأكل اللي بيزعّج قولونك، وزوّد الألياف والمايه بالتدريج، وقسّم الوجبات، وقلّل التوتر.',
      en: 'Track foods that upset your bowel, increase fibre and fluids gradually, split meals, and reduce stress.',
      fr: 'Repérez les aliments irritants, augmentez fibres et eau progressivement, fractionnez les repas, réduisez le stress.',
    },
  ],
  'doid:diverticulitis': [
    {
      ar: 'أثناء الألم الشديد خفّف الألياف مؤقتًا، واشرب مايه كفاية، وراقب الحرارة — راجع طبيب لو زاد الألم.',
      en: 'During severe pain, temporarily reduce fibre, keep fluids up, watch for fever, and see a doctor if pain worsens.',
      fr: 'En cas de douleur intense, réduisez temporairement les fibres, buvez, surveillez la fièvre, consultez si ça s’aggrave.',
    },
  ],
  'doid:gastroenteritis': [
    {
      ar: 'عوّض السوائل والأملاح (محلول معالجة الجفاف)، وكُل خفيف، وراقب علامات الجفاف (دوار، بول قليل).',
      en: 'Replace fluids and salts (oral rehydration), eat light, and watch for dehydration (dizziness, little urine).',
      fr: 'Réhydratez (solution de réhydratation), mangez léger, surveillez la déshydratation (vertiges, peu d’urine).',
    },
  ],
  'doid:gallstones': [
    {
      ar: 'قلّل الأكل الدسم جدًا، وكُل وجبات صغيرة منتظمة، وراقب الألم بعد الأكل الدسم — راجع طبيب لو استمر.',
      en: 'Reduce very fatty food, eat small regular meals, and watch pain after fatty meals — see a doctor if it persists.',
      fr: 'Réduisez les aliments très gras, mangez de petits repas réguliers, surveillez la douleur — consultez si elle persiste.',
    },
  ],
  'doid:hepatitis': [
    {
      ar: 'امتنع عن الكحول تمامًا، وقلّل الدهون، واشرب مايه كفاية، وراجع طبيب لعمل تحاليل الكبد.',
      en: 'Avoid alcohol completely, reduce fats, stay hydrated, and see a doctor for liver tests.',
      fr: 'Évitez totalement l’alcool, réduisez les graisses, hydratez-vous, consultez pour un bilan hépatique.',
    },
  ],
  'doid:pancreatitis': [
    {
      ar: 'امتنع عن الكحول والأكل الدسم تمامًا، واشرب سوائل، وراجع طبيب فورًا — الألم الشديد المنتقل للظهر علامة خطر.',
      en: 'Avoid alcohol and fatty food entirely, keep fluids up, and see a doctor promptly — severe pain to the back is a warning sign.',
      fr: 'Évitez totalement alcool et graisses, buvez, consultez vite — une douleur intense au dos est un signe d’alerte.',
    },
  ],
  'doid:uti': [
    {
      ar: 'اشرب مايه كفاية، وما تحبسش البول، وكمادات دافئة على أسفل البطن، وراجع طبيب لو ظهرت حرارة أو دم.',
      en: 'Drink enough water, do not hold urine, use warm compresses on the lower abdomen, and see a doctor if fever or blood appears.',
      fr: 'Buvez assez, ne retenez pas l’urine, compresses chaudes en bas du ventre, consultez si fièvre ou sang.',
    },
  ],
  'doid:kidney-stone': [
    {
      ar: 'اشرب مايه كتير (2–3 لتر يوميًا لو مسموح طبيًا)، وقلّل الملح والأوكسالات (شاي/سبانخ)، وراجع طبيب لو الألم شديد.',
      en: 'Drink plenty of water (2–3 L/day if medically allowed), reduce salt and oxalates, and see a doctor if pain is severe.',
      fr: 'Buvez beaucoup d’eau (2–3 L/j si permis), réduisez sel et oxalates, consultez si douleur intense.',
    },
  ],
  'doid:ovarian-cyst': [
    {
      ar: 'كمادات دافئة على أسفل البطن، وتابعي الألم مع الدورة، وراجعي طبيبة نساء — والطوارئ فورًا لو الألم مفاجئ شديد.',
      en: 'Warm compresses on the lower abdomen, track pain with your cycle, see a gynaecologist — ER immediately if sudden severe pain.',
      fr: 'Compresses chaudes en bas du ventre, suivez la douleur selon le cycle, consultez un gynécologue — urgences si douleur brutale.',
    },
  ],
  'doid:endometriosis': [
    {
      ar: 'كمادات دافئة وتابعي الألم مع الدورة، وراجعي طبيبة نساء لتقييم السبب ووضع خطة.',
      en: 'Warm compresses, track pain with your cycle, and see a gynaecologist to assess the cause and plan.',
      fr: 'Compresses chaudes, suivez la douleur selon le cycle, consultez un gynécologue pour évaluer et planifier.',
    },
  ],
  'doid:angina': [
    {
      ar: 'لو ألم الصدر بيجي مع المجهود، ارتاح فورًا، واطلب الطوارئ لو الألم مستمر أو مع ضيق نفس أو تعرّق.',
      en: 'If chest pain comes with exertion, stop and rest, and call emergency services if it persists or comes with breathlessness or sweating.',
      fr: 'Si la douleur thoracique survient à l’effort, arrêtez-vous, et appelez les urgences si elle persiste avec essoufflement ou sueurs.',
    },
  ],
  'doid:gerd-organ': [
    {
      ar: 'تجنّب الأكل قبل النوم بساعتين، وارفع رأس السرير، وقلّل الكافيين والدهون والبهارات.',
      en: 'Avoid eating within two hours of bedtime, raise the head of the bed, and reduce caffeine, fat, and spices.',
      fr: 'Évitez de manger deux heures avant le coucher, surélevez la tête du lit, réduisez caféine, graisses et épices.',
    },
  ],
};

function buildSelfCare(
  regions: DetectedRegion[],
  organs: DetectedOrgan[],
  conditions: ConditionMatch[],
  triage: TriageLevel,
  language: Lang,
): string[] {
  const tips: string[] = [];
  const push = (list?: LocalizedText[]) => {
    if (list) list.forEach((tip) => tips.push(localize(tip, language)));
  };

  // 1) نصائح مرتبطة بالمرض الأرجح (الأكثر تحديدًا) — تختلف حسب الحالة.
  conditions.slice(0, 2).forEach((c) => push(SELF_CARE_BY_CONDITION[c.id]));

  // 2) نصائح حسب العضو الداخلي المكتشف.
  organs.forEach((organ) => push(SELF_CARE_BY_ORGAN[organ.id]));

  // 3) نصائح حسب منطقة الجسم.
  regions.forEach((region) => push(SELF_CARE_BY_REGION[region.id]));

  // 4) نصيحة سلامة عامة تُضاف دائمًا.
  tips.push(localize(SELF_CARE_SAFETY, language));

  // 5) ملء الفراغ بنصائح عامة متنوّعة حسب شدّة الفَرز (بدل تكرار نفس السطور).
  const generalOrder =
    triage === 'emergency' || triage === 'urgent'
      ? [SELF_CARE_GENERAL[2], SELF_CARE_GENERAL[0], SELF_CARE_GENERAL[1]]
      : triage === 'soon'
        ? [SELF_CARE_GENERAL[0], SELF_CARE_GENERAL[2], SELF_CARE_GENERAL[1]]
        : [SELF_CARE_GENERAL[2], SELF_CARE_GENERAL[1], SELF_CARE_GENERAL[0]];
  generalOrder.forEach((tip) => tips.push(localize(tip, language)));

  return [...new Set(tips)].slice(0, 6);
}

const WHEN_TO_SEE: Record<TriageLevel, LocalizedText> = {
  self_care: {
    ar: 'راجع طبيبًا لو استمر الألم أكثر من أسبوع، أو زاد، أو ظهرت أعراض جديدة.',
    en: 'See a doctor if pain lasts more than a week, worsens, or new symptoms appear.',
    fr: 'Consultez si la douleur dure plus d’une semaine, s’aggrave ou si de nouveaux symptômes apparaissent.',
  },
  routine: {
    ar: 'احجز موعدًا مع طبيب لو استمر الألم أو تكرّر دون تحسّن.',
    en: 'Book a doctor visit if the pain persists or recurs without improvement.',
    fr: 'Prenez rendez-vous si la douleur persiste ou revient sans amélioration.',
  },
  soon: {
    ar: 'راجع طبيبًا خلال يوم أو يومين، وفورًا لو ظهرت علامة إنذار.',
    en: 'See a doctor within a day or two, and immediately if a red flag appears.',
    fr: 'Consultez sous un ou deux jours, et immédiatement si un signe d’alerte apparaît.',
  },
  urgent: {
    ar: 'اطلب تقييمًا عاجلًا اليوم. اذهب للطوارئ فورًا لو زادت الأعراض.',
    en: 'Seek an urgent evaluation today. Go to the ER immediately if symptoms worsen.',
    fr: 'Demandez une évaluation urgente aujourd’hui. Urgences immédiatement si aggravation.',
  },
  emergency: {
    ar: 'هذه حالة طارئة — اتصل بخدمات الطوارئ أو اذهب لأقرب مستشفى الآن.',
    en: 'This is an emergency — call emergency services or go to the nearest hospital now.',
    fr: 'C’est une urgence — appelez les urgences ou allez à l’hôpital maintenant.',
  },
};

const DISCLAIMER: LocalizedText = {
  ar: 'هذا إرشاد تعليمي وليس تشخيصًا طبيًا ولا بديلًا عن استشارة طبيب مؤهل.',
  en: 'This is educational guidance, not a medical diagnosis or a substitute for a qualified doctor.',
  fr: 'Ceci est une orientation éducative, pas un diagnostic médical ni un substitut à un médecin.',
};

const INTRO: Record<TriageLevel, LocalizedText> = {
  self_care: {
    ar: 'فاهم إن الألم مزعج، وخلينا نحلّله مع بعض بهدوء.',
    en: 'I understand the pain is annoying — let’s look at it together calmly.',
    fr: 'Je comprends que la douleur est gênante — analysons-la ensemble.',
  },
  routine: {
    ar: 'شكرًا إنك شاركت التفاصيل، ده يساعدنا نفهم الصورة أحسن.',
    en: 'Thanks for sharing the details — it helps us see the picture better.',
    fr: 'Merci pour les détails — cela aide à mieux comprendre.',
  },
  soon: {
    ar: 'الألم واضح في كلامك، وخلينا نرتب الخطوات المناسبة.',
    en: 'The pain comes through clearly — let’s organise the right steps.',
    fr: 'La douleur est claire — organisons les bonnes étapes.',
  },
  urgent: {
    ar: 'اللي ذكرته يستدعي انتباهًا طبيًا سريعًا، خلينا نتحرك صح.',
    en: 'What you described needs prompt medical attention — let’s act wisely.',
    fr: 'Ce que vous décrivez nécessite une attention médicale rapide.',
  },
  emergency: {
    ar: 'اللي ذكرته قد يكون علامة خطر، وخلينا نتصرّف بسرعة وأمان.',
    en: 'What you described may be a danger sign — let’s act quickly and safely.',
    fr: 'Ce que vous décrivez peut être un signe de danger — agissons vite.',
  },
};

/** مقدّمة عندما لا نفهم تفاصيل كافية من رسالة المستخدم. */
const INTRO_UNCLEAR: LocalizedText = {
  ar: 'تمام، عايز أفهمك صح — قوللي إيه اللي حاسس بيه بالظبط وأنا أساعدك.',
  en: 'Alright, let me understand you better — tell me exactly what you’re feeling.',
  fr: 'D’accord, laissez-moi mieux comprendre — dites-moi exactement ce que vous ressentez.',
};

const CLARIFY: LocalizedText = {  ar: 'قوللي أكتر عن الألم: مكانه فين، وشدته من 0 لـ10، وبقاله قد إيه؟',
  en: 'Tell me more about the pain: where it is, its intensity (0–10), and how long it’s been.',
  fr: 'Dites-m’en plus : où est la douleur, son intensité (0–10) et depuis combien de temps.',
};

/** مقدّمة عند إرفاق صورة فقط دون وصف نصّي. */
const IMAGE_INTRO: LocalizedText = {
  ar: 'شفت الصورة اللي أرفقتها 📷. التحليل البصري الآلي مش متاح من غير إنترنت، فساعدني بوصف بسيط وأنا أفهمك صح.',
  en: 'I see the photo you attached 📷. Automated image analysis isn’t available offline, so help me with a short description and I’ll understand you.',
  fr: 'Je vois la photo jointe 📷. L’analyse d’image automatique n’est pas disponible hors ligne ; décrivez brièvement et je vous comprendrai.',
};

/** سؤال توضيحي عند وجود صورة فقط. */
const IMAGE_CLARIFY: LocalizedText = {
  ar: 'قوللي: إيه اللي باين في الصورة (طفح/تورم/جرح/لون)، ومكانه فين في الجسم، وبقاله قد إيه؟',
  en: 'Tell me: what does the photo show (rash/swelling/wound/colour), where on the body, and for how long?',
  fr: 'Dites-moi : que montre la photo (éruption/gonflement/blessure/couleur), où sur le corps, et depuis quand ?',
};

// ---------------------------------------------------------------------------
// الدالة الرئيسية
// ---------------------------------------------------------------------------
export function analyzeMessage(rawText: string, language: Lang, hasImage = false): AssistantReply {
  const text = normalize(rawText);
  const regions = detectRegions(text);
  const detectedOrgans = detectOrgans(text);
  const locations = detectLocations(text);
  const symptoms = detectSymptoms(text);
  const redFlags = detectRedFlags(text);
  const severity = detectSeverity(text);
  const duration = detectDuration(text);

  // دمج الأعضاء المرشّحة من المواضع الدقيقة (مثل «شمال السرة» ⇒ الأمعاء).
  const organs = mergeLocationOrgans(detectedOrgans, locations);

  const hasText = regions.length > 0 || organs.length > 0 || symptoms.length > 0 || redFlags.length > 0;
  // الصورة وحدها تُعدّ إشارة مفهومة (نردّ بإرشاد) حتى لا نقول «لم أفهم».
  const understood = hasText || hasImage;
  const imageOnly = hasImage && !hasText;

  const triage = assessTriage(redFlags, severity, duration, regions, symptoms, organs);
  const conditions = understood ? scoreConditions(regions, symptoms, organs, locations) : [];

  const understanding: string[] = [];
  if (regions.length) {
    understanding.push(
      localize(
        {
          ar: `مناطق الجسم اللي ذكرتها: ${regions.map((r) => r.label.ar).join('، ')}.`,
          en: `Body areas you mentioned: ${regions.map((r) => r.label.en).join(', ')}.`,
          fr: `Zones mentionnées : ${regions.map((r) => r.label.fr).join(', ')}.`,
        },
        language,
      ),
    );
  }
  if (organs.length) {
    understanding.push(
      localize(
        {
          ar: `أعضاء داخلية ذكرتها: ${organs.map((o) => o.label.ar).join('، ')}.`,
          en: `Internal organs you mentioned: ${organs.map((o) => o.label.en).join(', ')}.`,
          fr: `Organes internes mentionnés : ${organs.map((o) => o.label.fr).join(', ')}.`,
        },
        language,
      ),
    );
  }
  if (locations.length) {
    understanding.push(
      localize(
        {
          ar: `الموضع الذي حدّدته: ${locations.map((l) => l.label.ar).join('، ')}.`,
          en: `Location you specified: ${locations.map((l) => l.label.en).join(', ')}.`,
          fr: `Localisation précisée : ${locations.map((l) => l.label.fr).join(', ')}.`,
        },
        language,
      ),
    );
  }
  if (symptoms.length) {
    understanding.push(
      localize(
        {
          ar: `أعراض لاحظتها: ${symptoms.map((s) => s.label.ar).join('، ')}.`,
          en: `Symptoms I noticed: ${symptoms.map((s) => s.label.en).join(', ')}.`,
          fr: `Symptômes notés : ${symptoms.map((s) => s.label.fr).join(', ')}.`,
        },
        language,
      ),
    );
  }
  if (severity !== null) {
    understanding.push(
      localize(
        { ar: `شدّة الألم المقدّرة: ${severity}/10.`, en: `Estimated pain intensity: ${severity}/10.`, fr: `Intensité estimée : ${severity}/10.` },
        language,
      ),
    );
  }
  if (duration) {
    const durationText: Record<keyof typeof DURATION_WORDS, LocalizedText> = {
      hours: { ar: 'المدة: منذ ساعات قليلة.', en: 'Duration: a few hours.', fr: 'Durée : quelques heures.' },
      days: { ar: 'المدة: منذ أيام.', en: 'Duration: a few days.', fr: 'Durée : quelques jours.' },
      weeks: { ar: 'المدة: منذ أسابيع.', en: 'Duration: weeks.', fr: 'Durée : des semaines.' },
      months: { ar: 'المدة: منذ شهور.', en: 'Duration: months.', fr: 'Durée : des mois.' },
    };
    understanding.push(localize(durationText[duration], language));
  }

  if (hasImage) {
    understanding.unshift(
      localize(
        {
          ar: '📷 أرفقت صورة — سأعتمد على وصفك النصّي، لأن التحليل البصري الآلي غير متاح دون إنترنت.',
          en: '📷 You attached a photo — I will rely on your text description, since automated image analysis is unavailable offline.',
          fr: '📷 Vous avez joint une photo — je me base sur votre description, l’analyse d’image automatique étant indisponible hors ligne.',
        },
        language,
      ),
    );
  }

  const organDetails: DetectedOrganDetail[] = organs.map((organ) => {
    const raw = ORGAN_DETAILS[organ.id];
    return {
      id: organ.id,
      label: organ.label,
      blurb: organ.blurb,
      location: raw?.location,
      symptoms: raw?.symptoms,
      causes: raw?.causes,
      warning: raw?.warning,
      recommendation: raw?.recommendation,
    };
  });

  const primaryRegion = regions[0] ?? null;
  const mapOrgan = organs.find((organ) => organ.onMap) ?? null;

  return {
    intro: understood ? (imageOnly ? IMAGE_INTRO : INTRO[triage.level]) : INTRO_UNCLEAR,
    understanding,
    understood,
    clarifyingQuestion: understood ? (imageOnly ? IMAGE_CLARIFY : null) : CLARIFY,
    triage,
    redFlags,
    regions,
    symptoms,
    organs,
    locations,
    organDetails,
    conditions,
    selfCare: buildSelfCare(regions, organs, conditions, triage.level, language),
    whenToSeeDoctor: WHEN_TO_SEE[triage.level],
    suggestedRegionId: primaryRegion ? primaryRegion.id : null,
    suggestedRegionLabel: primaryRegion ? primaryRegion.label : null,
    suggestedOrganId: mapOrgan ? mapOrgan.id : null,
    suggestedOrganLabel: mapOrgan ? mapOrgan.label : null,
    disclaimer: DISCLAIMER,
    __lang: language,
  };
}

// ---------------------------------------------------------------------------
// اقتراحات سريعة جاهزة للمستخدم (شرائح في الواجهة)
// ---------------------------------------------------------------------------
export const QUICK_PROMPTS: LocalizedText[] = [
  { ar: 'حاسس بألم في أسفل ضهري وبيمتد لرجلي من 3 أيام', en: 'I have lower back pain radiating to my leg for 3 days', fr: 'J’ai mal au bas du dos qui irradie dans la jambe depuis 3 jours' },
  { ar: 'عندي صداع شديد ودوخة من الصبح', en: 'I have a severe headache and dizziness since morning', fr: 'J’ai un mal de tête sévère et des vertiges depuis ce matin' },
  { ar: 'وجع في رقبتي وكتفي من الجلوس كتير', en: 'Neck and shoulder pain from sitting a lot', fr: 'Douleur au cou et à l’épaule à cause de la position assise' },
  { ar: 'ألم في صدري مع ضيق نفس', en: 'Chest pain with shortness of breath', fr: 'Douleur thoracique avec essoufflement' },
  { ar: 'ركبتي بتوجعني وبتورم بعد المجهود', en: 'My knee hurts and swells after activity', fr: 'Mon genou fait mal et gonfle après l’effort' },
];

export type { Lang, LocalizedText, RegionTerm, SymptomTerm };
