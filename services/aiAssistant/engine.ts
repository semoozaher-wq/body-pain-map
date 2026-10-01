// services/aiAssistant/engine.ts
// ============================================================================
// محرّك المساعد الذكي المحلي (Offline AI Engine)
// ----------------------------------------------------------------------------
// يفهم جملة المستخدم الحرة (عربي / إنجليزي / فرنسي) ويحوّلها إلى رد إرشادي:
//   1) تطبيع النص (إزالة التشكيل، توحيد الهمزات، تصغير الحروف اللاتينية).
//   2) استخراج: مناطق الجسم + الأعراض + علامات الإنذار + الشدّة + المدة.
//   3) حساب درجة الاستعجال (فرز إرشادي) مع مراعاة علامات الخطر.
//   4) مطابقة أمراض محتملة من المكتبة الطبية المحلية (diseaseLibrary) بترتيب
//      حسب درجة التطابق — مع استخدام محرّك البحث الذكي smartSearch + فلتر المنطقة.
//   5) توليد نصائح رعاية ذاتية عامة/حسب المنطقة + متى تطلب المساعدة.
//
// ⚠️ لا يقدّم تشخيصًا ولا قرارًا علاجيًا — إرشاد تعليمي فقط. كل شيء محلي.
// ============================================================================

import {
  getAllConditions,
  localize,
  smartSearch,
  type MedicalCondition,
} from '../medical/diseaseLibrary';
import organDetailsData from '../../data/organDetails.json';
import {
  ABDOMEN_LOCATIONS,
  BODY_REGIONS,
  DURATION_WORDS,
  NEGATION_WORDS,
  ORGAN_TERMS,
  RED_FLAG_TERMS,
  REGION_LOCATIONS,
  SEVERITY_WORDS,
  SYMPTOM_TERMS,
  SYMPTOM_TYPES,
  TIMINGS,
  CONTEXTS,
  SYMPTOM_CONDITIONS,
  SYMPTOM_TIMING_BOOSTS,
  CONTEXT_CONDITION_BOOSTS,
  MEDICATION_TERMS,
  FOLLOW_UP_QUESTIONS,
  type AbdomenLocation,
  type BodyRegionKey,
  type Lang,
  type LocalizedText,
  type OrganTerm,
  type RegionLocation,
  type RegionTerm,
  type SymptomTerm,
} from './lexicon';

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

export interface DetectedLocation {
  id: string;
  label: LocalizedText;
  organs: string[];
  regions: string[];
}

export interface DetectedSymptom {
  id: string;
  label: LocalizedText;
  redFlag: boolean;
  generic: boolean;
}

const URINARY_LOCATION_KEYWORDS = {
  ar: ['بول', 'البول', 'التبول', 'مثانة', 'المثانه', 'المسالك'],
  en: ['urine', 'urinary', 'urination', 'bladder'],
  fr: ['urine', 'urinaire', 'vessie'],
};

const RADIATION_KEYWORDS = {
  ar: ['نازل', 'بينزل', 'بتنزل', 'بيمتد', 'ممتد', 'رايح على', 'رايحه على', 'واصل', 'بيوصل', 'ينتشر', 'منتشر', 'بينتقل', 'بينزل على رجلي', 'نازل على رجلي'],
  en: ['radiat', 'spread', 'shooting down', 'going down', 'travels'],
  fr: ['irradi', 'descend', 'se propage'],
};

const INJURY_KEYWORDS = {
  ar: ['وقعت', 'وقع', 'كدمه', 'كدمة', 'ضربه', 'ضربة', 'التوت', 'التواء', 'لوي', 'كسر', 'جرح', 'اصابه', 'إصابة', 'حادثه', 'حادثة', 'رفعت تقيل', 'رفعت حاجه تقيله', 'شد عضلي'],
  en: ['injury', 'injured', 'fell', 'fall', 'twisted', 'sprain', 'accident'],
  fr: ['blessure', 'chute', 'entorse', 'accident'],
};

const uniq = (values: string[]): string[] => [...new Set(values.filter(Boolean))];

export interface DetectedMedication {
  id: string;
  label: LocalizedText;
  caution: LocalizedText;
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
  intro: LocalizedText;
  understanding: string[];
  understood: boolean;
  /** True when the assistant must ask for missing location before giving guidance. */
  clarificationOnly: boolean;
  clarifyingQuestion: LocalizedText | null;
  triage: TriageAssessment;
  redFlags: DetectedRedFlag[];
  regions: DetectedRegion[];
  symptoms: DetectedSymptom[];
  medications: DetectedMedication[];
  medicationQuestion: LocalizedText | null;
  followUpQuestion: LocalizedText | null;
  followUpOptions: LocalizedText[];
  organs: DetectedOrgan[];
  locations: DetectedLocation[];
  organDetails: DetectedOrganDetail[];
  conditions: ConditionMatch[];
  selfCare: string[];
  whenToSeeDoctor: LocalizedText;
  suggestedRegionId: string | null;
  suggestedRegionLabel: LocalizedText | null;
  suggestedOrganId: string | null;
  suggestedOrganLabel: LocalizedText | null;
  disclaimer: LocalizedText;
  /** Structured, updatable clinical picture built turn by turn (spec #5, #13). */
  painContext: PainContext;
  /** Copyable/shareable summary for a doctor visit (spec #11). */
  doctorSummary: string;
  /** True when the latest message changed a previous interpretation (spec #2). */
  corrected: boolean;
  __lang: Lang;
}

/**
 * Structured pain context. The assistant keeps this organised and updatable so
 * it never re-asks something the user already answered, and so a later
 * correction overrides an earlier interpretation instead of being ignored.
 */
export interface PainContext {
  painLocation: string | null;
  painLocationLabel: LocalizedText | null;
  painOnset: string | null;
  painDuration: string | null;
  painSeverity: number | null;
  painQuality: string[];
  radiation: boolean;
  aggravatingFactors: string[];
  relievingFactors: string[];
  associatedSymptoms: string[];
  injury: boolean;
  medications: string[];
  redFlags: string[];
  userCorrections: string[];
}

// ---------------------------------------------------------------------------
// تطبيع النص
// ---------------------------------------------------------------------------
// Arabic diacritics + tatweel (\u0640). Tatweel is a *letter* used to stretch a
// word ("\u062c\u0640\u0640\u0645\u0628\u064a"); it must be stripped or the stretched spelling never matches the
// "\u062c\u0645\u0628\u064a" keyword and the assistant falls back to asking again.
const AR_DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;

// Zero-width / bidi control marks that survive copy-paste on mobile keyboards
// and silently break substring matching.
const INVISIBLE_MARKS = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(INVISIBLE_MARKS, '')
    .replace(AR_DIACRITICS, '')
    // Accent folding for French/Latin input: a phone keyboard writes "cote" as
    // often as "côté", and both must hit the same keyword.
    .replace(/[àâäáãå]/g, 'a')
    .replace(/[èéêë]/g, 'e')
    .replace(/[ìíîï]/g, 'i')
    .replace(/[òóôõö]/g, 'o')
    .replace(/[ùúûü]/g, 'u')
    .replace(/ç/g, 'c')
    .replace(/œ/g, 'oe')
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

// Generic body-area nouns the user may give INSTEAD of a precise sub-location
// ("\u0648\u0633\u0637 \u0627\u0644\u0638\u0647\u0631", "\u0628\u0637\u0646\u064a", "\u062c\u0646\u0628").
// Rule from the loop-breaker spec: any place word the user offers, even a general
// one, counts as a *sufficient* answer - it must stop the location question
// instead of feeding it. Keyed on the normalised form.
//
// Words that already resolve to a region ("\u062c\u0646\u0628\u064a" -> obliques, "\u0636\u0647\u0631\u064a" -> lower
// back) deliberately stay out of this set: those keep the message ambiguous
// enough to ask once, which is the behaviour the acceptance flow expects.
// Relative directions ("\u0645\u0646 \u0641\u0648\u0642", "\u0645\u0646 \u062a\u062d\u062a") are not places and stay out too.
const GENERIC_AREA_WORDS = new Set<string>([
  // Arabic
  '\u0645\u0646\u0637\u0642\u0647',
  '\u0645\u0646\u0627\u0637\u0642',
  '\u062c\u0647\u0647',
  '\u0646\u0627\u062d\u064a\u0647',
  '\u0648\u0633\u0637',
  '\u0648\u0633\u0637\u0647',
  // English
  'area',
  'region',
  'zone',
  'middle',
  'part',
  // French
  'zones',
  'endroit',
  'milieu',
  'partie',
]);

/**
 * True when the user literally named a place, even a vague one.
 * A generic place word is treated as a sufficient location answer so the
 * assistant answers instead of repeating the location question.
 *
 * Note: Arabic has no word boundaries for short clitics such as "\u0648" (and),
 * so we match either a standalone token or a prefixed one ("\u0648\u0627\u0644\u0645\u0646\u0637\u0642\u0647").
 */
export function mentionsGenericArea(text: string): boolean {
  const haystack = normalize(text);
  if (!haystack) return false;
  const tokens = haystack.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  return tokens.some((token) => {
    // Arabic glues clitics onto the noun: "منطقة" becomes "المنطقة" with the
    // article and "والمنطقة" with the article plus the conjunction. We never
    // strip blindly (a bare "و" is also a real letter in "وسط"), we generate the
    // candidate forms and accept the token if ANY of them matches.
    const candidates = [token];
    for (const prefix of ['و', 'ال', 'وال', 'لل', 'بال', 'فال', 'كال']) {
      if (token.startsWith(prefix)) candidates.push(token.slice(prefix.length));
    }
    return candidates.some((candidate) => {
      if (candidate.length < 2) return false;
      if (GENERIC_AREA_WORDS.has(candidate)) return true;
      return [...GENERIC_AREA_WORDS].some((word) => word.length >= 3 && candidate.startsWith(word));
    });
  });
}

function matchAny(text: string, keywords: Record<Lang, string[]>): boolean {
  return [...keywords.ar, ...keywords.en, ...keywords.fr].some((k) => containsKeyword(text, k));
}

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
export function extractSymptomType(text: string): string[] {
  return Object.entries(SYMPTOM_TYPES)
    .filter(([, bucket]) => matchAny(text, bucket.keywords))
    .map(([id]) => id);
}

export function extractTiming(text: string): string[] {
  return Object.entries(TIMINGS)
    .filter(([, bucket]) => matchAny(text, bucket.keywords))
    .map(([id]) => id);
}

export function extractContext(text: string): string[] {
  return Object.entries(CONTEXTS)
    .filter(([, bucket]) => matchAny(text, bucket.keywords))
    .map(([id]) => id);
}

export function extractLocation(text: string, regions: DetectedRegion[] = [], organs: DetectedOrgan[] = []): string | null {
  if (regions.length > 0) return regions[0].id;
  if (organs.length > 0) return organs[0].id;
  if (matchAny(text, URINARY_LOCATION_KEYWORDS)) return 'urinary';
  return null;
}

function canonicalSymptomLocation(locationKey: string | null): string | null {
  if (!locationKey) return null;
  if (['lower-back', 'upper-back', 'mid-back'].includes(locationKey)) return 'back';
  if (['calves', 'ankles'].includes(locationKey)) return 'legs';
  if (['forearm', 'wrist'].includes(locationKey)) return 'hands';
  return locationKey;
}

export function detectRegions(text: string): DetectedRegion[] {
  // For every region keep the LONGEST keyword that matched. A short, greedy
  // keyword ("الكتف" -> shoulder, "ظهري" -> lower back) must not survive when a
  // longer, more specific phrase of another region is present in the same
  // message ("بين لوح الكتف" -> upper back, "ظهري من فوق" -> upper back).
  const matches: { region: RegionTerm; hit: string }[] = [];
  BODY_REGIONS.forEach((region) => {
    let best = '';
    [...region.keywords.ar, ...region.keywords.en, ...region.keywords.fr].forEach((keyword) => {
      if (!containsKeyword(text, keyword)) return;
      const normalized = normalize(keyword);
      if (normalized.length > best.length) best = normalized;
    });
    if (best && !isNegated(text, best)) matches.push({ region, hit: best });
  });
  const kept = matches.filter(
    (candidate) =>
      !matches.some(
        (other) =>
          other !== candidate &&
          other.hit.length > candidate.hit.length &&
          other.hit.includes(candidate.hit),
      ),
  );
  const found = new Map<string, DetectedRegion>();
  kept.forEach(({ region }) => {
    found.set(region.id, { id: region.id, region: region.region, label: region.label });
  });
  return [...found.values()];
}

/** Upper / mid / lower back share one anatomical region but are distinct spots. */
const BACK_REGION_IDS = ['upper-back', 'mid-back', 'lower-back'];

/**
 * Broad / limb-level regions. Naming ONLY one of these (a whole leg, the head,
 * the chest, a back segment, a whole arm segment) is genuinely ambiguous: the
 * anatomy map splits each into several distinct sub-parts. The spec requires the
 * assistant to open a short natural location dialogue first instead of dumping a
 * full medical report on the very first message.
 *
 * Regions that are already a single actionable structure (eye, ear, jaw, tooth,
 * throat, breast, groin, abdomen, knee, ankle, foot) are deliberately NOT here:
 * they answer immediately, exactly as the existing acceptance criteria demand.
 */
const BROAD_REGION_IDS = new Set<string>([
  'legs',        // الرجل والساق -> فخذ / ركبة / سمانة / كاحل / قدم
  'head',        // الرأس -> مقدمة / مؤخرة / جنب / قمة
  'neck',        // الرقبة -> أمام / خلف / يمين / شمال
  'chest',       // الصدر -> يمين / شمال / نص / تحت الضلوع
  'upper-back',  // أعلى الظهر
  'mid-back',    // وسط الظهر
  'lower-back',  // أسفل الظهر
]);

/** True when the region names a whole limb/segment with several distinct parts. */
export function isBroadRegion(regionId: string): boolean {
  return BROAD_REGION_IDS.has(regionId);
}

/**
 * Detects an explicit user correction ("لا، قصدي فوق", "مش كده، أنا أقصد تحت").
 * A correction means the NEW information wins and the old interpretation is
 * dropped (spec #2).
 */
export function detectCorrection(text: string): boolean {
  const tokens = text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  const markers = new Set(['لا', 'لأ', 'لاء', 'مش', 'قصدي', 'اقصد', 'قصدت', 'مقصدي', 'بالعكس']);
  return tokens.some((token) => markers.has(token));
}

/**
 * Resolves which back segment a message points to. Returns null when the text
 * carries no directional information (a bare "ظهري" stays at its default).
 * `allowBare` lets a short correction ("فوق" / "تحت" / "وسط") be understood on
 * its own once the user has already named the back.
 */
export function resolveBackSegment(
  text: string,
  allowBare = false,
): 'upper-back' | 'mid-back' | 'lower-back' | null {
  const has = (...words: string[]) => words.some((word) => text.includes(normalize(word)));
  if (has('بين الكتفين', 'بين كتافي', 'بين لوح الكتف', 'بين لوحي الكتف', 'بين لوحى الكتف')) return 'upper-back';
  if (
    has(
      'من فوق', 'ضهري من فوق', 'ظهري من فوق', 'فوق ضهري', 'فوق ظهري',
      'اعلى ضهري', 'اعلى ظهري', 'أعلى الظهر', 'الظهر العلوي', 'اعلي ضهري', 'اعلي ظهري',
    )
  ) return 'upper-back';
  if (
    has(
      'من تحت', 'تحت ضهري', 'تحت ظهري', 'اسفل ضهري', 'اسفل ظهري',
      'اسفل الظهر', 'تحت الخصر', 'قطني', 'القطنية', 'حقوي', 'الحرقفة',
    )
  ) return 'lower-back';
  if (
    has(
      'وسط ضهري', 'وسط ظهري', 'نص ضهري', 'نص ظهري', 'منتصف ضهري',
      'منتصف ظهري', 'وسط الظهر', 'نص الظهر', 'منتصف الظهر',
    )
  ) return 'mid-back';
  if (allowBare) {
    if (has('فوق', 'اعلى', 'اعلي', 'أعلى')) return 'upper-back';
    if (has('تحت', 'اسفل', 'أسفل')) return 'lower-back';
    if (has('وسط', 'نص', 'منتصف')) return 'mid-back';
  }
  return null;
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

export function detectMedications(text: string): DetectedMedication[] {
  return MEDICATION_TERMS
    .filter((term) => matchAny(text, term.keywords))
    .map((term) => ({ id: term.id, label: term.label, caution: term.caution }));
}

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

export function detectRegionLocations(text: string): RegionLocation[] {
  const found = new Map<string, RegionLocation>();
  REGION_LOCATIONS.forEach((loc) => {
    const hit = [...loc.keywords.ar, ...loc.keywords.en, ...loc.keywords.fr].find((k) =>
      containsKeyword(text, k),
    );
    if (hit && !isNegated(text, hit)) {
      found.set(loc.id, loc);
    }
  });
  return [...found.values()];
}

export function needsClarification(
  regions: DetectedRegion[],
  regionLocations: RegionLocation[],
  abdomenLocations: DetectedLocation[],
  redFlags: DetectedRedFlag[],
  organs: DetectedOrgan[] = [],
): boolean {
  if (redFlags.length > 0) return false;
  if (regionLocations.length > 0) return false;
  if (abdomenLocations.length > 0) return false;
  if (organs.length > 0) return false;
  // Only a genuinely ambiguous spot keeps the location question alive. The
  // flank ("my side") can mean muscle, kidney, rib, or bowel, so it is worth one
  // question. Specific regions such as the eye, ear, jaw, tooth, throat,
  // breast, groin, abdomen, or foot are already actionable and must answer
  // immediately instead of looping on the same question.
  return regions.length === 0 || regions.some((region) => region.id === 'obliques');
}

function buildLocationQuestion(regions: DetectedRegion[], language: Lang): LocalizedText {
  if (regions.length === 0) return CLARIFY;
  const primary = regions[0];

  // For a broad / limb-level region we name the *distinct parts of the same
  // limb* (its sibling regions), which reads like a real clinician asking
  // "the leg — do you mean the thigh, the knee, the calf, the ankle, or the
  // foot?". For a narrow region (e.g. the flank) we fall back to the fine
  // sub-locations of that region.
  if (isBroadRegion(primary.id)) {
    const siblings = BODY_REGIONS
      .filter((region) => region.region === primary.region && region.id !== primary.id)
      .map((region) => region.label[language]);
    if (siblings.length >= 2) {
      const list = siblings.join('، ');
      return {
        ar: `تقصد فين بالظبط في ${primary.label.ar}؟ ${list}؟`,
        en: `Where exactly in the ${primary.label.en}? The ${list}?`,
        fr: `Où exactement dans ${primary.label.fr} ? ${list} ?`,
      };
    }
  }

  const locations = REGION_LOCATIONS.filter((l) => l.parent === primary.id);
  if (locations.length === 0) return CLARIFY;
  const list = locations.map((l) => l.label[language]).join('، ');
  return {
    ar: `الألم في ${primary.label.ar} — فين بالظبط؟ (${list})`,
    en: `Pain in the ${primary.label.en} — where exactly? (${list})`,
    fr: `Douleur dans ${primary.label.fr} — où exactement ? (${list})`,
  };
}

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

export function detectSeverity(text: string): number | null {
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

function buildOrganWeights(organs: DetectedOrgan[], locations: DetectedLocation[]): Map<string, number> {
  const weights = new Map<string, number>();
  const bump = (id: string, w: number) => weights.set(id, Math.max(weights.get(id) ?? 0, w));
  organs.forEach((o) => bump(o.id, 6));
  locations.forEach((loc) => {
    loc.organs.forEach((id, index) => bump(id, index === 0 ? 6 : 3));
  });
  return weights;
}

/**
 * مطابقة الأمراض المحتملة — v3.
 * ----------------------------------------------------------------------------
 * 1) تستخدم محرّك البحث الذكي `smartSearch` على النص الأصلي.
 * 2) تفلتر نتائج smartSearch حسب منطقة الجسم المذكورة.
 * 3) تعطي bonus للحالات اللي regions أو muscleGroups بتاعتها مطابقة.
 * 4) تدمج النتايج مع منطق المطابقة القديم (regions / symptoms / organs).
 * 5) ترتّب النتايج النهائية حسب أعلى score وتُعيد أول 4 حالات.
 */
export function scoreConditions(
  regions: DetectedRegion[],
  symptoms: DetectedSymptom[],
  organs: DetectedOrgan[] = [],
  locations: DetectedLocation[] = [],
  rawText: string = '',
  symptomTypes: string[] = [],
  timings: string[] = [],
  contexts: string[] = [],
): ConditionMatch[] {
  const specificSymptoms = symptoms.filter((s) => !s.generic);
  const symptomBases = new Set(specificSymptoms.map((s) => symBase(s.id)));
  const organWeights = buildOrganWeights(organs, locations);
  const localized = organs.length > 0 || locations.length > 0;
  const hasSpecificEvidence =
    specificSymptoms.length > 0 || organs.length > 0 || locations.length > 0;

  const queryRegions = new Set(regions.map((r) => r.region));
  const locationKey = canonicalSymptomLocation(extractLocation(rawText, regions, organs));
  const primarySymptomType = symptomTypes[0] ?? null;
  const exactIds = primarySymptomType && locationKey
    ? (SYMPTOM_CONDITIONS[primarySymptomType]?.[locationKey] ?? [])
    : [];
  const filteredExactIds = exactIds.filter((id) => {
    if (id !== 'local:cervical-zoster') return true;
    return matchAny(rawText, {
      ar: ['طفح', 'طفح جلدي', 'حويصلات', 'حبوب مؤلمة'],
      en: ['rash', 'blister', 'blisters'],
      fr: ['éruption', 'vésicules'],
    });
  });
  const secondaryIds = new Set<string>();
  if (primarySymptomType === 'tingling' && locationKey === 'neck' && regions.some((region) => region.id === 'hands')) {
    secondaryIds.add('doid:13241');
  }
  if (primarySymptomType === 'burning' && locationKey === 'neck') {
    const hasRash = matchAny(rawText, {
      ar: ['طفح', 'طفح جلدي', 'حويصلات', 'حبوب مؤلمة'],
      en: ['rash', 'blister', 'blisters'],
      fr: ['éruption', 'vésicules'],
    });
    if (hasRash) secondaryIds.add('local:cervical-zoster');
  }
  const generalIds = !locationKey && primarySymptomType
    ? (SYMPTOM_CONDITIONS[primarySymptomType]?._all ?? [])
    : [];
  const allowedIds = new Set(filteredExactIds.length > 0 ? [...filteredExactIds, ...secondaryIds] : generalIds);
  const hasPreciseRule = filteredExactIds.length > 0;

  const timingBoostIds = new Set<string>();
  timings.forEach((timing) => {
    const ids = primarySymptomType ? SYMPTOM_TIMING_BOOSTS[primarySymptomType]?.[timing] ?? [] : [];
    ids.forEach((id) => timingBoostIds.add(id));
  });
  const contextBoostIds = new Set<string>();
  contexts.forEach((context) => {
    (CONTEXT_CONDITION_BOOSTS[context] ?? []).forEach((id) => contextBoostIds.add(id));
  });

  const scored: ConditionMatch[] = [];
  const seen = new Set<string>();

  // A known location without a curated symptom+location rule must not fall
  // back to unrelated location-only conditions. Ask for clarification instead.
  if (primarySymptomType && locationKey && filteredExactIds.length === 0) return [];

  // When a precise symptom+location rule exists, use only that curated set.
  // This prevents the old location-only search from flooding the answer with
  // unrelated conditions just because they mention the same body region.
  if (allowedIds.size > 0) {
    getAllConditions().forEach((condition) => {
      if (!allowedIds.has(condition.id)) return;
      let score = hasPreciseRule ? 1000 : 700;
      if (timingBoostIds.has(condition.id)) score += 300;
      if (contextBoostIds.has(condition.id)) score += 150;
      if (symptomBases.size > 0) {
        condition.symptoms.forEach((sid) => {
          if (symptomBases.has(symBase(sid))) score += 40;
        });
      }
      scored.push({
        id: condition.id,
        name: condition.name,
        summary: condition.summary,
        icd10: condition.icd10,
        medlinePlusUrl: condition.medlinePlusUrl,
        score,
      });
      seen.add(condition.id);
    });

    // If the curated IDs are stale or unavailable in the medical library, do
    // not silently fall back to unrelated location results.
    if (scored.length > 0) {
      return scored.sort((a, b) => b.score - a.score).slice(0, 4);
    }
  }

  // No exact symptom rule: symptom-only rules get a focused search. If none
  // exists, preserve the previous smartSearch/location behaviour.
  if (allowedIds.size > 0) {
    return [];
  }

  if (rawText && rawText.trim().length >= 2) {
    try {
      const smartResults = smartSearch(rawText, getAllConditions(), 12);
      smartResults.forEach((r) => {
        if (queryRegions.size > 0 && r.condition.regions.length > 0) {
          const matchesRegion = r.condition.regions.some((cr) => queryRegions.has(cr as any));
          const hasMuscleMatch = r.condition.muscleGroups.some((mg) =>
            regions.some((reg) => reg.id === mg),
          );
          if (!matchesRegion && !hasMuscleMatch) return;
        }

        if (r.condition.diffuse && localized) return;
        if (seen.has(r.condition.id)) return;
        seen.add(r.condition.id);

        let bonus = 0;
        if (queryRegions.size > 0) {
          if (r.condition.regions.some((cr) => queryRegions.has(cr as any))) bonus += 500;
          if (r.condition.muscleGroups.some((mg) => regions.some((reg) => reg.id === mg))) bonus += 300;
        }
        if (timingBoostIds.has(r.condition.id)) bonus += 300;
        if (contextBoostIds.has(r.condition.id)) bonus += 150;

        scored.push({
          id: r.condition.id,
          name: r.condition.name,
          summary: r.condition.summary,
          icd10: r.condition.icd10,
          medlinePlusUrl: r.condition.medlinePlusUrl,
          score: r.score * 3 + bonus,
        });
      });
    } catch {
      // Continue with the deterministic matcher below.
    }
  }

  getAllConditions().forEach((condition: MedicalCondition) => {
    if (seen.has(condition.id)) return;
    if (organs.length > 0 && !condition.organs?.some((id) => organWeights.has(id))) return;

    let score = 0;
    regions.forEach((region) => {
      if (condition.regions.includes(region.region) && hasSpecificEvidence) score += 2;
      if (condition.muscleGroups.includes(region.id)) score += 2;
    });
    organs.forEach((organ) => {
      if (condition.regions.includes(organ.region)) score += 1;
    });
    if (condition.organs) {
      condition.organs.forEach((oid) => {
        const w = organWeights.get(oid);
        if (w) score += w;
      });
    }
    condition.symptoms.forEach((sid) => {
      if (symptomBases.has(symBase(sid))) score += 3;
    });
    if (condition.diffuse) {
      if (localized) score -= 5;
      if (regions.length <= 1 && organs.length === 0) score -= 3;
    }
    if (timingBoostIds.has(condition.id)) score += 300;
    if (contextBoostIds.has(condition.id)) score += 150;
    if (!hasSpecificEvidence && score <= 0) return;
    if (score > 0) {
      seen.add(condition.id);
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
const TRIAGE_ORDER: TriageLevel[] = ['self_care', 'routine', 'soon', 'urgent', 'emergency'];

const ORGAN_TRIAGE_FLOOR: Partial<Record<string, TriageLevel>> = {
  heart: 'soon',
  lungs: 'routine',
  kidneys: 'routine',
  appendix: 'soon',
  pancreas: 'soon',
  gallbladder: 'routine',
  testicles: 'urgent',
};

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
    return { level: 'emergency', title: TRIAGE_META.emergency.title, advice: TRIAGE_META.emergency.advice };
  }
  if (hasUrgent || redFlagSymptom || (severity !== null && severity >= 9)) {
    return { level: 'urgent', title: TRIAGE_META.urgent.title, advice: TRIAGE_META.urgent.advice };
  }
  if (severity !== null && severity >= 7) {
    return { level: 'soon', title: TRIAGE_META.soon.title, advice: TRIAGE_META.soon.advice };
  }
  if (duration === 'weeks' || duration === 'months' || regions.length >= 2) {
    return { level: 'routine', title: TRIAGE_META.routine.title, advice: TRIAGE_META.routine.advice };
  }
  return { level: 'self_care', title: TRIAGE_META.self_care.title, advice: TRIAGE_META.self_care.advice };
}

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

// ---------------------------------------------------------------------------
// نصائح الرعاية الذاتية
// ---------------------------------------------------------------------------
const SELF_CARE_SAFETY: LocalizedText = {
  ar: 'لا تبدأ أدوية أو جرعات من عندك — استشر صيدلي أو طبيب.',
  en: 'Do not self-prescribe medicines or doses — ask a pharmacist or doctor.',
  fr: 'Ne prenez pas de médicaments de vous-même — demandez à un pharmacien ou médecin.',
};

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
  feet: [
    { ar: 'قلّل الوقوف والمشي مؤقتًا، وارفع القدم عند وجود تورّم، واستخدم حذاءً مريحًا وداعمًا.', en: 'Reduce standing and walking temporarily, elevate the foot if swollen, and wear supportive comfortable shoes.', fr: 'Réduisez temporairement la marche et la station debout, surélevez le pied s’il est gonflé et portez des chaussures adaptées.' },
    { ar: 'لو الألم في الكعب أسوأ مع أول خطوات الصباح، جرّب تمارين إطالة لطيفة لباطن القدم والساق بدون ألم.', en: 'If heel pain is worse with the first morning steps, try gentle pain-free stretches for the sole and calf.', fr: 'Si la douleur du talon est pire aux premiers pas, essayez des étirements doux et indolores de la plante et du mollet.' },
  ],
  legs: [
    { ar: 'حدّد هل الألم في الفخذ أو الساق أو خلف الركبة، وهل يمتد من الظهر أو يصاحبه تورم في ساق واحدة؛ تجنّب المجهود حتى تتضح الصورة.', en: 'Note whether the pain is in the thigh, calf, or behind the knee, and whether it radiates from the back or causes one-sided swelling; avoid exertion until clearer.', fr: 'Précisez si la douleur est dans la cuisse, le mollet ou derrière le genou, et si elle vient du dos ou s’accompagne d’un gonflement unilatéral ; évitez l’effort.' },
  ],
  eyes: [
    { ar: 'تجنّب فرك العين أو وضع قطرات علاجية من نفسك، واطلب تقييمًا عاجلًا عند تغيّر النظر أو إصابة أو ألم شديد.', en: 'Avoid rubbing the eye or using medicated drops without advice; seek urgent assessment for vision change, injury, or severe pain.', fr: 'Évitez de frotter l’œil ou d’utiliser des gouttes médicamenteuses sans avis ; consultez vite en cas de baisse de vision, blessure ou douleur intense.' },
  ],
  ears: [
    { ar: 'لا تدخل أعوادًا أو أدوات داخل الأذن، وراقب الحرارة أو الإفرازات أو ضعف السمع.', en: 'Do not put cotton buds or objects into the ear; watch for fever, discharge, or hearing loss.', fr: 'N’introduisez pas d’objet dans l’oreille ; surveillez fièvre, écoulement ou baisse de l’audition.' },
  ],
  jaw: [
    { ar: 'لو في ألم أو طقطقة في الفك أو صعوبة في فتح الفم، تجنّب الأكل الصلب والمضغ العنيف، واستخدم كمادة دافئة، وراجع طبيب أسنان أو طبيبًا لو استمر الألم أو صاحبته حرارة.', en: 'If the jaw is painful, clicking, or hard to open, avoid hard food and forceful chewing, use a warm compress, and see a dentist or doctor if pain persists or fever appears.', fr: 'Si la mâchoire est douloureuse, craque ou s’ouvre difficilement, évitez les aliments durs et la mastication forcée, appliquez une compresse chaude et consultez un dentiste ou un médecin si la douleur persiste ou si une fièvre apparaît.' },
  ],
  teeth: [
    { ar: 'نظّف المنطقة بلطف وتجنّب شديد السخونة أو البرودة، واحجز موعدًا مع طبيب أسنان إذا استمر الألم أو ظهر تورّم.', en: 'Clean gently, avoid very hot or cold foods, and arrange a dental visit if pain persists or swelling appears.', fr: 'Nettoyez doucement, évitez le très chaud ou très froid, et consultez un dentiste si la douleur persiste ou si un gonflement apparaît.' },
  ],
  throat: [
    { ar: 'اشرب سوائل وراقب الحرارة والقدرة على البلع والتنفس؛ صعوبة التنفس أو بلع اللعاب تستدعي الطوارئ.', en: 'Drink fluids and monitor fever and your ability to swallow and breathe; breathing difficulty or inability to swallow saliva is an emergency.', fr: 'Buvez et surveillez la fièvre ainsi que la déglutition et la respiration ; difficulté à respirer ou à avaler la salive = urgence.' },
  ],
  breast: [
    { ar: 'لاحظ وجود كتلة أو احمرار أو إفرازات أو تغيّر جديد، واحجز تقييمًا طبيًا بدل الاعتماد على موضع الألم وحده.', en: 'Watch for a lump, redness, discharge, or new change, and arrange a clinical assessment rather than relying on pain location alone.', fr: 'Surveillez masse, rougeur, écoulement ou changement nouveau et demandez un examen clinique plutôt que de vous fier au seul emplacement.' },
  ],
  groin: [
    { ar: 'تجنّب حمل الأوزان مؤقتًا ولا تضغط على أي انتفاخ؛ الألم الشديد أو الانتفاخ الذي لا يرجع أو القيء يحتاج تقييمًا عاجلًا.', en: 'Avoid heavy lifting and do not press a bulge; severe pain, a non-reducible bulge, or vomiting needs urgent assessment.', fr: 'Évitez de porter lourd et n’appuyez pas sur une bosse ; douleur intense, bosse irréductible ou vomissements nécessitent une évaluation urgente.' },
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
  testicles: [
    {
      ar: 'ألم الخصية يحتاج معرفة هل بدأ فجأة وهل يوجد تورّم أو احمرار أو غثيان؛ لا تضغط على المكان ولا تمارس مجهودًا، واطلب تقييمًا عاجلًا اليوم.',
      en: 'Testicular pain needs prompt assessment for sudden onset, swelling, redness, or nausea; do not press the area or exert yourself, and seek same-day care.',
      fr: 'Une douleur testiculaire doit être évaluée rapidement selon son début, le gonflement, la rougeur ou les nausées ; évitez la pression et l’effort, consultez aujourd’hui.',
    },
  ],
};

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

  conditions.slice(0, 2).forEach((c) => push(SELF_CARE_BY_CONDITION[c.id]));
  organs.forEach((organ) => push(SELF_CARE_BY_ORGAN[organ.id]));
  regions.forEach((region) => push(SELF_CARE_BY_REGION[region.id]));
  tips.push(localize(SELF_CARE_SAFETY, language));

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

const INTRO_UNCLEAR: LocalizedText = {
  ar: 'تمام، عايز أفهمك صح — قوللي إيه اللي حاسس بيه بالظبط وأنا أساعدك.',
  en: 'Alright, let me understand you better — tell me exactly what you’re feeling.',
  fr: 'D’accord, laissez-moi mieux comprendre — dites-moi exactement ce que vous ressentez.',
};

const CLARIFY: LocalizedText = {
  ar: 'قوللي أكتر عن الألم: مكانه فين، وشدته من 0 لـ10، وبقاله قد إيه؟',
  en: 'Tell me more about the pain: where it is, its intensity (0–10), and how long it’s been.',
  fr: 'Dites-m’en plus : où est la douleur, son intensité (0–10) et depuis combien de temps.',
};

// Shown when the loop breaker fires: the user already answered the location
// question, so we answer with what we have instead of asking a third time.
const RESOLVED_INTRO: LocalizedText = {
  ar: 'تمام — أخدت بالي الموقع اللي ذكرته، ودي القراءة الكاملة على أساس اللي قلته بدون ما أسألك تاني.',
  en: 'Got it — I’ll go with the area you gave me. Here is the full reading, no more questions.',
  fr: 'Compris — je m’appuie sur la zone que vous m’avez donnée. Voici la lecture complète, sans autre question.',
};

const IMAGE_INTRO: LocalizedText = {
  ar: 'شفت الصورة اللي أرفقتها 📷. التحليل البصري الآلي مش متاح من غير إنترنت، فساعدني بوصف بسيط وأنا أفهمك صح.',
  en: 'I see the photo you attached 📷. Automated image analysis isn’t available offline, so help me with a short description and I’ll understand you.',
  fr: 'Je vois la photo jointe 📷. L’analyse d’image automatique n’est pas disponible hors ligne ; décrivez brièvement et je vous comprendrai.',
};


const NO_PRECISE_MATCH: LocalizedText = {
  ar: `الأعراض اللي ذكرتها مش عندي احتمال دقيق ليها في قاعدة البيانات. بس ممكن أساعدك بالخطوات دي:

1. وضّح أكتر: فين بالظبط في المكان اللي بيوجعك (يمين/شمال/ورا/قُدّام)؟
2. العرض مستمر ولا متقطع؟
3. فيه أعراض تانية (تنميل اليد، ضعف عضلي، صداع)؟
4. من إمتى بدأ؟

نصايح عامة:
✓ ارتاح وابعد عن الوضعيات اللي بتزود الألم
✓ اشرب ماء كفاية ونم كويس
✓ لو الأعراض زادت أو ظهر تنميل في اليد، استشر طبيب
✓ استشارة الطبيب أهم من أي معلومة تقديرية`,
  en: `I do not have a precise match for the symptoms you described in my database, but I can still help you:

1. Clarify the exact spot (right/left/front/back).
2. Is the symptom constant or intermittent?
3. Are there other symptoms such as hand numbness, muscle weakness, or headache?
4. When did it start?

General steps:
✓ Rest and avoid positions that make the symptom worse
✓ Drink enough water and sleep well
✓ If symptoms worsen or hand numbness appears, seek medical advice
✓ A clinician’s assessment is more important than any estimated information`,
  fr: `Je n’ai pas de correspondance précise pour les symptômes décrits dans ma base, mais je peux quand même vous aider :

1. Précisez l’endroit exact (droite/gauche/devant/derrière).
2. Le symptôme est-il constant ou intermittent ?
3. Y a-t-il d’autres symptômes comme un engourdissement de la main, une faiblesse musculaire ou un mal de tête ?
4. Depuis quand a-t-il commencé ?

Conseils généraux :
✓ Reposez-vous et évitez les positions qui aggravent le symptôme
✓ Buvez suffisamment et dormez correctement
✓ Si les symptômes s’aggravent ou si un engourdissement de la main apparaît, consultez un médecin
✓ L’évaluation d’un professionnel reste plus importante que toute estimation`
};

const IMAGE_CLARIFY: LocalizedText = {
  ar: 'قوللي: إيه اللي باين في الصورة (طفح/تورم/جرح/لون)، ومكانه فين في الجسم، وبقاله قد إيه؟',
  en: 'Tell me: what does the photo show (rash/swelling/wound/colour), where on the body, and for how long?',
  fr: 'Dites-moi : que montre la photo (éruption/gonflement/blessure/couleur), où sur le corps, et depuis quand ?',
};

// ---------------------------------------------------------------------------
// الدالة الرئيسية
// ---------------------------------------------------------------------------
/**
 * Copyable / shareable summary the patient can show a doctor (spec #11).
 * It only restates what the user reported - never a diagnosis.
 */
function buildDoctorSummary(ctx: PainContext, language: Lang): string {
  const L = (ar: string, en: string, fr: string) =>
    language === 'ar' ? ar : language === 'en' ? en : fr;
  const none = L('غير محدد', 'not specified', 'non précisé');
  const label = ctx.painLocationLabel ? ctx.painLocationLabel[language] : none;
  const quality = ctx.painQuality.length
    ? ctx.painQuality.map((id) => (SYMPTOM_TYPES[id]?.label[language] ?? id)).join('، ')
    : none;
  const severity = ctx.painSeverity !== null ? `${ctx.painSeverity}/10` : none;
  const duration = ctx.painDuration ?? none;
  const onset = ctx.painOnset ?? none;
  const aggrav = ctx.aggravatingFactors.length ? ctx.aggravatingFactors.join('، ') : none;
  const meds = ctx.medications.length ? ctx.medications.join('، ') : L('لا يوجد', 'none', 'aucun');
  const flags = ctx.redFlags.length ? ctx.redFlags.join('، ') : L('لا يوجد', 'none', 'aucun');
  const yes = L('نعم', 'yes', 'oui');
  const no = L('لا', 'no', 'non');
  return [
    L('📋 ملخص زيارة الطبيب', '📋 Doctor visit summary', '📋 Résumé pour le médecin'),
    `${L('• المنطقة', '• Area', '• Zone')}: ${label}`,
    `${L('• البداية', '• Onset', '• Début')}: ${onset}`,
    `${L('• المدة', '• Duration', '• Durée')}: ${duration}`,
    `${L('• شدة الألم', '• Pain intensity', '• Intensité')}: ${severity}`,
    `${L('• نوع الألم', '• Pain quality', '• Type de douleur')}: ${quality}`,
    `${L('• يمتد لمكان آخر', '• Radiates elsewhere', '• Irradiation')}: ${ctx.radiation ? yes : no}`,
    `${L('• عوامل تزيد الألم', '• Aggravating factors', '• Facteurs aggravants')}: ${aggrav}`,
    `${L('• أدوية تم تناولها', '• Medications taken', '• Médicaments pris')}: ${meds}`,
    `${L('• إصابة سابقة', '• Injury', '• Traumatisme')}: ${ctx.injury ? yes : no}`,
    `${L('• علامات تحذيرية', '• Red flags', '• Signes d\u2019alerte')}: ${flags}`,
    L(
      '⚠️ هذا ملخص للمعلومات التي ذكرتها، وليس تشخيصًا. اعرضه على الطبيب.',
      '⚠️ This summarises what you reported, not a diagnosis. Show it to your doctor.',
      '⚠️ Ceci résume ce que vous avez décrit, pas un diagnostic. Montrez-le à votre médecin.',
    ),
  ].join('\n');
}

/**
 * One relevant follow-up question at a time (spec #4, #25). Picks the most
 * important still-missing field instead of dumping every question at once.
 */
function buildSmartFollowUp(ctx: PainContext): LocalizedText | null {
  if (!ctx.painLocation) {
    return { ar: 'تقدر تحدد لي مكان الألم بالتحديد فين؟', en: 'Can you point to exactly where the pain is?', fr: 'Pouvez-vous préciser exactement où se situe la douleur ?' };
  }
  // Severity first, then duration: the natural clinical intake order and the
  // order the acceptance dialogue expects ("في الساق" -> follow-up -> "شدته 7").
  if (ctx.painSeverity === null) {
    return { ar: 'قيّم شدة الألم من 1 لـ 10، كام؟', en: 'On a scale of 1 to 10, how intense is the pain?', fr: 'Sur une échelle de 1 à 10, quelle est l\u2019intensité ?' };
  }
  if (!ctx.painDuration) {
    return { ar: 'الألم بدأ من إمتى؟ (ساعات / أيام / أسابيع)', en: 'When did the pain start? (hours / days / weeks)', fr: 'Quand la douleur a-t-elle commencé ? (heures / jours / semaines)' };
  }
  if (ctx.painQuality.length === 0) {
    return { ar: 'الألم شكله إيه؟ (شد / حرقان / نغز / تنميل / تقل)', en: 'What does the pain feel like? (tight / burning / stabbing / tingling / heaviness)', fr: 'À quoi ressemble la douleur ? (tension / brûlure / élancement / fourmillement / lourdeur)' };
  }
  if (!ctx.radiation) {
    return { ar: 'الألم بيمتد أو بينزل لمكان تاني زي الرجل؟', en: 'Does the pain radiate or travel elsewhere, like down the leg?', fr: 'La douleur irradie-t-elle ailleurs, par exemple dans la jambe ?' };
  }
  if (ctx.aggravatingFactors.length === 0) {
    return { ar: 'إيه اللي بيزود الألم؟ (الحركة / الانحناء / الجلوس / الشد)', en: 'What makes the pain worse? (movement / bending / sitting / straining)', fr: 'Qu\u2019est-ce qui aggrave la douleur ? (mouvement / flexion / position assise / effort)' };
  }
  return null;
}

export function analyzeMessage(
  rawText: string,
  language: Lang,
  hasImage = false,
  options: {
    /** User pushed back (or enough turns passed): always answer, never ask again. */
    forceAnswer?: boolean;
    /** How many clarifying questions this conversation has already produced. */
    askCount?: number;
    /** How many messages the user has sent in this conversation. */
    userTurnCount?: number;
    /** Structured context carried over from the previous turn (spec #5, #13). */
    previousContext?: PainContext;
  } = {},
): AssistantReply {
  const text = normalize(rawText);
  const detectedRegions = detectRegions(text);
  const detectedOrgans = detectOrgans(text);
  const locations = detectLocations(text);
  const regionLocations = detectRegionLocations(text);
  let regions = detectedRegions.length > 0
    ? detectedRegions
    : [...new Map(regionLocations.map((location) => {
      const parent = BODY_REGIONS.find((region) => region.id === location.parent);
      return parent ? [parent.id, { id: parent.id, region: parent.region, label: parent.label }] as const : null;
    }).filter((entry): entry is readonly [string, { id: string; region: BodyRegionKey; label: LocalizedText }] => entry !== null))].map(([, region]) => region);

  // Correction-aware back-segment resolution (spec #1, #2, #12). A directional
  // phrase or an explicit correction ("لا، قصدي فوق") must override the default
  // reading of a bare "ظهري" instead of being silently ignored.
  const previous = options.previousContext;
  const isCorrection = detectCorrection(text);
  const hasBackRegion = regions.some((region) => BACK_REGION_IDS.includes(region.id));
  let corrected = false;
  if (isCorrection || hasBackRegion) {
    const segment = resolveBackSegment(text, isCorrection);
    const segRegion = segment ? BODY_REGIONS.find((region) => region.id === segment) : null;
    if (segRegion) {
      const others = regions.filter((region) => !BACK_REGION_IDS.includes(region.id));
      corrected = isCorrection || !regions.some((region) => region.id === segment);
      regions = [{ id: segRegion.id, region: segRegion.region, label: segRegion.label }, ...others];
    }
  }

  // Relative follow-ups are contextual. If the previous turn established a
  // back segment, a bare "فوق" / "تحت" / "وسط" updates that segment instead
  // of being interpreted as a brand-new generic complaint.
  if (previous?.painLocation && BACK_REGION_IDS.includes(previous.painLocation) && !hasBackRegion) {
    const prev = previous.painLocation;
    let relative: 'upper-back' | 'mid-back' | 'lower-back' | null = null;
    if (/(^|\s)(فوق|اعلى|اعلي|أعلى)(\s|$)/.test(text)) {
      relative = prev === 'lower-back' ? 'mid-back' : prev === 'mid-back' ? 'upper-back' : 'upper-back';
    } else if (/(^|\s)(تحت|اسفل|أسفل)(\s|$)/.test(text)) {
      relative = prev === 'upper-back' ? 'mid-back' : prev === 'mid-back' ? 'lower-back' : 'lower-back';
    } else if (/(^|\s)(وسط|نص|منتصف)(\s|$)/.test(text)) {
      relative = 'mid-back';
    }
    if (relative) {
      const segRegion = BODY_REGIONS.find((region) => region.id === relative);
      if (segRegion) {
        const others = regions.filter((region) => !BACK_REGION_IDS.includes(region.id));
        regions = [{ id: segRegion.id, region: segRegion.region, label: segRegion.label }, ...others];
        corrected = true;
      }
    }
  }
  const symptoms = detectSymptoms(text);
  const medications = detectMedications(text);
  const severity = detectSeverity(text);
  const duration = detectDuration(text);
  const symptomTypes = extractSymptomType(text);
  const timings = extractTiming(text);
  const contexts = extractContext(text);
  const extractedLocation = extractLocation(text, regions, detectedOrgans);

  const redFlags = [...detectRedFlags(text)];
  const hasChest = regions.some((region) => region.id === 'chest');
  const hasHead = regions.some((region) => region.id === 'head');
  const hasLegs = regions.some((region) => region.id === 'legs' || region.id === 'calves');
  const hasAbdomen = regions.some((region) => region.id === 'abs');
  const hasEyes = regions.some((region) => region.id === 'eyes');
  const hasBreathlessness = matchAny(text, { ar: ['ضيق نفس', 'ضيق في التنفس', 'مش قادر أتنفس', 'كتمة'], en: ['shortness of breath', 'breathless'], fr: ['essoufflement'] });
  const hasSuddenHeadache = matchAny(text, { ar: ['صداع مفاجئ', 'صداع شديد مفاجئ', 'وجع راس مفاجئ'], en: ['sudden headache', 'sudden severe headache'], fr: ['céphalée soudaine'] });
  if (hasChest && symptomTypes.includes('burning')) redFlags.push({ id: 'rf:chest-burning', level: 'emergency', label: { ar: 'حرقان في الصدر يحتاج تقييمًا طارئًا', en: 'Chest burning needs emergency assessment', fr: 'Une brûlure thoracique nécessite une évaluation urgente' } });
  if (hasChest && symptomTypes.includes('tingling') && hasBreathlessness) redFlags.push({ id: 'rf:chest-tingling-breath', level: 'emergency', label: { ar: 'وخز في الصدر مع ضيق نفس', en: 'Chest tingling with shortness of breath', fr: 'Fourmillements thoraciques avec essoufflement' } });
  if (hasHead && symptomTypes.includes('stabbing') && hasSuddenHeadache) redFlags.push({ id: 'rf:sudden-stabbing-headache', level: 'emergency', label: { ar: 'نغزة أو صداع مفاجئ شديد في الرأس', en: 'Sudden severe stabbing headache', fr: 'Céphalée lancinante soudaine et intense' } });
  if (hasChest && symptomTypes.includes('pressure')) redFlags.push({ id: 'rf:chest-pressure', level: 'emergency', label: { ar: 'ضغط أو عصر في الصدر يحتاج تقييمًا طارئًا', en: 'Chest pressure or squeezing needs emergency assessment', fr: 'Une pression ou compression thoracique nécessite une évaluation urgente' } });
  if (hasLegs && symptomTypes.includes('heaviness') && matchAny(text, { ar: ['تورم', 'ورم', 'ساق واحدة', 'رجل واحدة'], en: ['swelling', 'one leg'], fr: ['gonflement', 'une jambe'] })) redFlags.push({ id: 'rf:leg-heaviness-swelling', level: 'urgent', label: { ar: 'ثقل الساق مع تورم يحتاج تقييمًا عاجلًا لاستبعاد جلطة وريدية', en: 'Leg heaviness with swelling needs urgent assessment for possible DVT', fr: 'Lourdeur de jambe avec gonflement : évaluation urgente pour exclure une thrombose' } });
  if (hasLegs && symptomTypes.includes('heaviness') && !redFlags.some((flag) => flag.id === 'rf:leg-heaviness-swelling')) redFlags.push({ id: 'rf:leg-heaviness', level: 'urgent', label: { ar: 'ثقل جديد أو واضح في الساق يستحسن تقييمه طبيًا، خصوصًا إذا كان في ساق واحدة أو معه تورم', en: 'New or marked leg heaviness should be medically assessed, especially if one-sided or associated with swelling', fr: 'Une lourdeur nouvelle ou importante de la jambe mérite une évaluation médicale, surtout si elle est unilatérale ou accompagnée de gonflement' } });
  if (hasAbdomen && symptomTypes.includes('throbbing') && matchAny(text, { ar: ['شديد', 'مفاجئ', 'حاد'], en: ['severe', 'sudden'], fr: ['intense', 'soudain'] })) redFlags.push({ id: 'rf:abdominal-throbbing', level: 'emergency', label: { ar: 'نبض أو ألم شديد مفاجئ في البطن يحتاج تقييمًا طارئًا', en: 'Sudden severe abdominal throbbing needs emergency assessment', fr: 'Une douleur abdominale pulsatile brutale et intense nécessite une évaluation urgente' } });
  if (hasHead && symptomTypes.includes('heaviness') && matchAny(text, { ar: ['ضعف', 'شلل', 'لخبطة كلام', 'صعوبة كلام'], en: ['weakness', 'paralysis', 'speech difficulty'], fr: ['faiblesse', 'paralysie', 'trouble de la parole'] })) redFlags.push({ id: 'rf:head-heaviness-neuro', level: 'emergency', label: { ar: 'ثقل الرأس مع أعراض عصبية مفاجئة يحتاج طوارئ', en: 'Head heaviness with sudden neurological symptoms needs emergency care', fr: 'Lourdeur de la tête avec symptômes neurologiques soudains : urgence' } });
  if (hasEyes && symptomTypes.includes('pressure') && matchAny(text, { ar: ['تشوش', 'زغللة', 'فقدان نظر', 'رؤية'], en: ['blurred vision', 'vision loss'], fr: ['vision floue', 'perte de vision'] })) redFlags.push({ id: 'rf:eye-pressure-vision', level: 'emergency', label: { ar: 'ضغط العين مع تغير مفاجئ في الرؤية يحتاج طوارئ', en: 'Eye pressure with sudden vision change needs emergency care', fr: 'Pression oculaire avec changement brutal de la vision : urgence' } });

  // Structured, updatable pain context (spec #5, #13). New information wins;
  // anything the user already told us is carried forward so we never re-ask it.
  const painContext: PainContext = {
    painLocation: regions[0]?.id ?? previous?.painLocation ?? null,
    painLocationLabel: regions[0]?.label ?? previous?.painLocationLabel ?? null,
    painOnset: timings[0] ?? previous?.painOnset ?? null,
    painDuration: duration ?? previous?.painDuration ?? null,
    painSeverity: severity ?? previous?.painSeverity ?? null,
    painQuality: uniq([...symptomTypes, ...(previous?.painQuality ?? [])]),
    radiation: matchAny(text, RADIATION_KEYWORDS) || (previous?.radiation ?? false),
    aggravatingFactors: uniq([...contexts, ...(previous?.aggravatingFactors ?? [])]),
    relievingFactors: previous?.relievingFactors ?? [],
    associatedSymptoms: uniq([...symptoms.map((item) => item.id), ...(previous?.associatedSymptoms ?? [])]),
    injury: matchAny(text, INJURY_KEYWORDS) || (previous?.injury ?? false),
    medications: uniq([...medications.map((item) => item.id), ...(previous?.medications ?? [])]),
    redFlags: uniq([...redFlags.map((flag) => flag.id), ...(previous?.redFlags ?? [])]),
    userCorrections: isCorrection
      ? uniq([rawText.trim(), ...(previous?.userCorrections ?? [])])
      : (previous?.userCorrections ?? []),
  };

  const { forceAnswer = false, askCount = 0, userTurnCount = 0 } = options;

  // Two independent loop breakers, matching the accepted criteria:
  //  1. the explicit counter, still tolerant of ONE asked question;
  //  2. a hard ceiling: from the user's 3rd message onward we always answer,
  //     whatever the precision of what they gave us.
  const askedEnough = askCount >= 2 || userTurnCount >= 3;

  const organs = mergeLocationOrgans(detectedOrgans, locations);

  // ROOT-CAUSE FIX (spec #2, #3): a first pain message that names ONLY a broad,
  // limb-level region ("my leg from below", "my head", "my chest") must open a
  // short natural location dialogue instead of jumping straight to the medical
  // report. We only treat it as ambiguous while the message is a *bare*
  // complaint - no severity, no duration, no medication, no radiation, no
  // symptom type, no generic place word, no second region, no sub-location and
  // no organ/red-flag. Anything richer is already precise enough to answer.
  const bareComplaint =
    duration === null &&
    severity === null &&
    medications.length === 0 &&
    symptomTypes.length === 0 &&
    !matchAny(text, RADIATION_KEYWORDS) &&
    !mentionsGenericArea(rawText);
  const broadOnlyComplaint =
    bareComplaint &&
    regions.length === 1 &&
    isBroadRegion(regions[0].id) &&
    regionLocations.length === 0 &&
    locations.length === 0 &&
    organs.length === 0 &&
    redFlags.length === 0;

  const missingLocation =
    (needsClarification(regions, regionLocations, locations, redFlags, organs) || broadOnlyComplaint) &&
    // A named place - even a vague one such as "\u0648\u0633\u0637 \u0627\u0644\u0638\u0647\u0631" - is a sufficient answer.
    !mentionsGenericArea(rawText);
  const mustAnswer = forceAnswer || askedEnough;
  const askForLocation = missingLocation && !mustAnswer;

  const hasText =
    regions.length > 0 || organs.length > 0 || symptoms.length > 0 || redFlags.length > 0;
  const understood = hasText || hasImage;
  const imageOnly = hasImage && !hasText;

  const triage = assessTriage(redFlags, severity, duration, regions, symptoms, organs);

  const organNeedsProtectedMatching = organs.some((organ) => organ.id === 'testicles');
  const conditions = understood && !askForLocation && !organNeedsProtectedMatching
    ? scoreConditions(regions, symptoms, organs, locations, rawText, symptomTypes, timings, contexts)
    : [];

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

  if (symptomTypes.length) {
    understanding.push(
      localize(
        {
          ar: `نوع العرض: ${symptomTypes.map((id) => SYMPTOM_TYPES[id].label.ar).join('، ')}.`,
          en: `Symptom type: ${symptomTypes.map((id) => SYMPTOM_TYPES[id].label.en).join(', ')}.`,
          fr: `Type de symptôme : ${symptomTypes.map((id) => SYMPTOM_TYPES[id].label.fr).join(', ')}.`,
        },
        language,
      ),
    );
  }
  if (timings.length) {
    understanding.push(
      localize(
        {
          ar: `التوقيت: ${timings.map((id) => TIMINGS[id].label.ar).join('، ')}.`,
          en: `Timing: ${timings.map((id) => TIMINGS[id].label.en).join(', ')}.`,
          fr: `Moment : ${timings.map((id) => TIMINGS[id].label.fr).join(', ')}.`,
        },
        language,
      ),
    );
  }
  if (contexts.length) {
    understanding.push(
      localize(
        {
          ar: `السياق: ${contexts.map((id) => CONTEXTS[id].label.ar).join('، ')}.`,
          en: `Context: ${contexts.map((id) => CONTEXTS[id].label.en).join(', ')}.`,
          fr: `Contexte : ${contexts.map((id) => CONTEXTS[id].label.fr).join(', ')}.`,
        },
        language,
      ),
    );
  }
  if (severity !== null) {
    understanding.push(
      localize(
        {
          ar: `شدّة الألم المقدّرة: ${severity}/10.`,
          en: `Estimated pain intensity: ${severity}/10.`,
          fr: `Intensité estimée : ${severity}/10.`,
        },
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

  const followUpQuestion = understood && !askForLocation
    ? buildSmartFollowUp(painContext)
    : null;
  const medicationQuestion = medications.length > 0
    ? { ar: 'إيه الجرعة وإمتى أخدته؟ وهل عندك حساسية أو مانع طبي؟', en: 'What dose did you take and when? Any allergy or medical reason to avoid it?', fr: 'Quelle dose et quand ? Avez-vous une allergie ou une contre-indication ?' }
    : null;

  const primaryRegion = regions[0] ?? null;
  const mapOrgan = askForLocation ? null : (organs.find((organ) => organ.onMap) ?? null);

  // The engine only ever *asks* while it is in the location-question state. Once
  // the user pushes back (a named place, the counter, or the hard ceiling) we
  // return a full answer instead. `clarificationOnly` therefore collapses to
  // exactly `askForLocation` - which is what the screen's counter reads.
  const clarificationOnly = askForLocation;

  return {
    intro: mustAnswer && understood ? RESOLVED_INTRO : (understood ? (imageOnly ? IMAGE_INTRO : INTRO[triage.level]) : INTRO_UNCLEAR),
    understanding,
    understood,
    clarificationOnly,
    clarifyingQuestion: askForLocation
      ? buildLocationQuestion(regions, language)
      : ((symptomTypes.length > 0 && extractedLocation && conditions.length === 0) ||
        (!understood && rawText.trim().length > 0 && !imageOnly)
        ? NO_PRECISE_MATCH
        : (understood && !imageOnly ? null : (imageOnly ? IMAGE_CLARIFY : CLARIFY))),
    triage,
    redFlags,
    regions,
    symptoms,
    medications: askForLocation ? [] : medications,
    medicationQuestion: askForLocation ? null : medicationQuestion,
    followUpQuestion: askForLocation ? null : followUpQuestion,
    followUpOptions: askForLocation ? [] : FOLLOW_UP_QUESTIONS,
    organs,
    locations,
    organDetails: askForLocation ? [] : organDetails,
    conditions,
    selfCare: askForLocation ? [] : buildSelfCare(regions, organs, conditions, triage.level, language),
    whenToSeeDoctor: WHEN_TO_SEE[triage.level],
    suggestedRegionId: primaryRegion ? primaryRegion.id : null,
    suggestedRegionLabel: primaryRegion ? primaryRegion.label : null,
    suggestedOrganId: mapOrgan ? mapOrgan.id : null,
    suggestedOrganLabel: mapOrgan ? mapOrgan.label : null,
    disclaimer: DISCLAIMER,
    painContext,
    doctorSummary: understood ? buildDoctorSummary(painContext, language) : '',
    corrected,
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
