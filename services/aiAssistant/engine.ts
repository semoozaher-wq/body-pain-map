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
import {
  BODY_REGIONS,
  DURATION_WORDS,
  NEGATION_WORDS,
  RED_FLAG_TERMS,
  SEVERITY_WORDS,
  SYMPTOM_TERMS,
  type BodyRegionKey,
  type Lang,
  type LocalizedText,
  type RegionTerm,
  type SymptomTerm,
} from './lexicon';

export type TriageLevel = 'self_care' | 'routine' | 'soon' | 'urgent' | 'emergency';

export interface DetectedRegion {
  id: string;
  region: BodyRegionKey;
  label: LocalizedText;
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
  conditions: ConditionMatch[];
  selfCare: string[];
  whenToSeeDoctor: LocalizedText;
  suggestedRegionId: string | null;
  suggestedRegionLabel: LocalizedText | null;
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

/** هل الكلمة مسبوقة بنفي؟ (نافذة 14 حرفًا قبلها). */
function isNegated(text: string, keyword: string): boolean {
  const needle = normalize(keyword);
  const idx = text.indexOf(needle);
  if (idx <= 0) return false;
  const before = text.slice(Math.max(0, idx - 14), idx);
  return [...NEGATION_WORDS.ar, ...NEGATION_WORDS.en, ...NEGATION_WORDS.fr].some((n) =>
    before.includes(normalize(n)),
  );
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
): ConditionMatch[] {
  const symptomBases = new Set(symptoms.map((s) => symBase(s.id)));
  const scored: ConditionMatch[] = [];

  getAllConditions().forEach((condition: MedicalCondition) => {
    let score = 0;
    regions.forEach((region) => {
      if (condition.regions.includes(region.region)) score += 2;
      if (condition.muscleGroups.includes(region.id)) score += 2;
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
function assessTriage(
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

function buildSelfCare(regions: DetectedRegion[], language: Lang): string[] {
  const tips: string[] = [];
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

// ---------------------------------------------------------------------------
// الدالة الرئيسية
// ---------------------------------------------------------------------------
export function analyzeMessage(rawText: string, language: Lang): AssistantReply {
  const text = normalize(rawText);
  const regions = detectRegions(text);
  const symptoms = detectSymptoms(text);
  const redFlags = detectRedFlags(text);
  const severity = detectSeverity(text);
  const duration = detectDuration(text);

  const understood = regions.length > 0 || symptoms.length > 0 || redFlags.length > 0;

  const triage = assessTriage(redFlags, severity, duration, regions, symptoms);
  const conditions = understood ? scoreConditions(regions, symptoms) : [];

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

  const primaryRegion = regions[0] ?? null;

  return {
    intro: understood ? INTRO[triage.level] : INTRO_UNCLEAR,
    understanding,
    understood,
    clarifyingQuestion: understood ? null : CLARIFY,
    triage,
    redFlags,
    regions,
    symptoms,
    conditions,
    selfCare: buildSelfCare(regions, language),
    whenToSeeDoctor: WHEN_TO_SEE[triage.level],
    suggestedRegionId: primaryRegion ? primaryRegion.id : null,
    suggestedRegionLabel: primaryRegion ? primaryRegion.label : null,
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
