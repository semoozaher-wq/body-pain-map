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
  BODY_REGIONS,
  DURATION_WORDS,
  NEGATION_WORDS,
  ORGAN_TERMS,
  RED_FLAG_TERMS,
  SEVERITY_WORDS,
  SYMPTOM_TERMS,
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

export interface DetectedSymptom {
  id: string;
  label: LocalizedText;
  redFlag: boolean;
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
      found.set(symptom.id, { id: symptom.id, label: symptom.label, redFlag: symptom.redFlag });
    }
  });
  return [...found.values()];
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

export function scoreConditions(
  regions: DetectedRegion[],
  symptoms: DetectedSymptom[],
  organs: DetectedOrgan[] = [],
): ConditionMatch[] {
  const symptomBases = new Set(symptoms.map((s) => symBase(s.id)));
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
    condition.symptoms.forEach((sid) => {
      if (symptomBases.has(symBase(sid))) score += 3;
    });
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

const SELF_CARE_GENERAL: LocalizedText[] = [
  { ar: 'ارتاح بشكل نسبي وتجنّب الراحة الطويلة تمامًا — الحركة اللطيفة غالبًا أفضل.', en: 'Rest relatively; avoid total prolonged rest — gentle movement is often better.', fr: 'Reposez-vous relativement ; évitez le repos total prolongé — le mouvement doux aide souvent.' },
  { ar: 'استخدم كمادة دافئة أو باردة حسب ما يريحك (دافئة للشد العضلي، باردة للتورم).', en: 'Use a warm or cold compress as it suits you (warm for muscle strain, cold for swelling).', fr: 'Compresse chaude ou froide selon ce qui soulage (chaude pour la contracture, froide pour le gonflement).' },
  { ar: 'اشرب ماء كفاية ونم جيدًا؛ قلة النوم تزيد الإحساس بالألم.', en: 'Stay hydrated and sleep well; poor sleep increases pain perception.', fr: 'Hydratez-vous et dormez bien ; le manque de sommeil augmente la douleur.' },
  { ar: 'لا تبدأ أدوية أو جرعات من عندك — استشر صيدلي أو طبيب.', en: 'Do not self-prescribe medicines or doses — ask a pharmacist or doctor.', fr: 'Ne prenez pas de médicaments de vous-même — demandez à un pharmacien ou médecin.' },
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
};

function buildSelfCare(regions: DetectedRegion[], organs: DetectedOrgan[], language: Lang): string[] {
  const tips: string[] = [];
  organs.forEach((organ) => {
    const extra = SELF_CARE_BY_ORGAN[organ.id];
    if (extra) extra.forEach((tip) => tips.push(localize(tip, language)));
  });
  regions.forEach((region) => {
    const extra = SELF_CARE_BY_REGION[region.id];
    if (extra) extra.forEach((tip) => tips.push(localize(tip, language)));
  });
  SELF_CARE_GENERAL.forEach((tip) => tips.push(localize(tip, language)));
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
  const organs = detectOrgans(text);
  const symptoms = detectSymptoms(text);
  const redFlags = detectRedFlags(text);
  const severity = detectSeverity(text);
  const duration = detectDuration(text);

  const hasText = regions.length > 0 || organs.length > 0 || symptoms.length > 0 || redFlags.length > 0;
  // الصورة وحدها تُعدّ إشارة مفهومة (نردّ بإرشاد) حتى لا نقول «لم أفهم».
  const understood = hasText || hasImage;
  const imageOnly = hasImage && !hasText;

  const triage = assessTriage(redFlags, severity, duration, regions, symptoms, organs);
  const conditions = understood ? scoreConditions(regions, symptoms, organs) : [];

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
    organDetails,
    conditions,
    selfCare: buildSelfCare(regions, organs, language),
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
