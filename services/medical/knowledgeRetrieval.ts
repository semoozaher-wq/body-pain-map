// services/medical/knowledgeRetrieval.ts
// ============================================================================
// Medical Knowledge Layer + Retrieval (طبقة المعرفة الطبية + الاسترجاع)
// ----------------------------------------------------------------------------
// هذا الملف *لا* يُنشئ مكتبة طبية جديدة. هو طبقة استرجاع (Retrieval) فوق
// المكتبة الطبية الموجودة أصلاً في المشروع:
//   • services/medical/diseaseLibrary.ts  → الأمراض + الأعراض + Red Flags + المصادر
//   • services/medical/regionTaxonomy.ts  → البنى التشريحية المُصنّفة (عظم/مفصل/
//     عضلة/وتر/رباط/عصب/وعاء/عضو...) + المناطق والأوصاف
//   • data/medical/sources.json           → سجل المصادر المفتوحة (ترخيص/رابط)
//
// الهدف: عند وصول سؤال من المستخدم، نسترجع فقط المعرفة المناسبة (عدد محدود)
// مع مصدر كل معلومة، ثم تُمرَّر إلى Gemini ليصوغ الرد منها فقط. إذا لم توجد
// معرفة موثوقة نُعيد القيمة الحسّاسة: no_reliable_knowledge.
//
// ملاحظات:
//   • الملف نقي (pure): لا يستورد أي شيء من React Native ولا من الشبكة، حتى
//     يمكن استيراده من نقطة الخادم api/assistant.ts ومن الاختبارات.
//   • المعرفة الطبية هنا منفصلة تماماً عن TCM/الوخز بالإبر (لا خلط).
//   • لا نضع آلاف المعلومات في الـPrompt: نُمرّر فقط أفضل عدد محدود (MAX_ITEMS).
// ============================================================================

import {
  getAllConditions,
  getAllSymptoms,
  smartSearch,
  localize,
  hasRedFlags,
  type Language,
  type MedicalCondition,
  type MedicalSymptom,
} from './diseaseLibrary';
import {
  getAllStructures,
  getTaxonomy,
  localizePair,
  type AnatomicalStructure,
} from './regionTaxonomy';
import sourcesData from '../../data/medical/sources.json';

// ---------------------------------------------------------------------------
// القيمة الحسّاسة (Sentinel) عند غياب معرفة موثوقة
// ---------------------------------------------------------------------------
/** تُستخدم حرفيًّا كما هي عند عدم توفّر معرفة موثوقة في مكتبة المشروع. */
export const NO_RELIABLE_KNOWLEDGE = 'no_reliable_knowledge' as const;

// ---------------------------------------------------------------------------
// عتبات الموثوقية (مُعايَرة على مكتبة المشروع: الاستعلامات الحقيقية تُنتج
// درجات عالية بينما الضجيج/أوامر التطبيق تُنتج درجات منخفضة جدًا)
// ---------------------------------------------------------------------------
/** أدنى درجة لقبول حالة مرضية كمطابقة موثوقة. */
const MIN_CONDITION_SCORE = 200;
/** أدنى درجة لقبول عنصر سياقي (بنية/منطقة/عرض). */
const MIN_CONTEXT_SCORE = 150;
/** أقصى عدد عناصر تُمرَّر إلى الـPrompt (نمنع آلاف المعلومات). */
const MAX_ITEMS = 6;
/** أقصى طول لنص مقتطف يُمرَّر إلى الـPrompt. */
const MAX_TEXT = 320;
const MAX_REDFLAG_TEXT = 240;

// ---------------------------------------------------------------------------
// سجل المصادر المفتوحة (من بيانات المشروع)
// ---------------------------------------------------------------------------
interface SourceRecord {
  id: string;
  name: string;
  url: string;
  type: string;
  license: string;
  usage: string;
  attributionRequired: boolean;
}
const SOURCE_REGISTRY: SourceRecord[] = (sourcesData as { sources: SourceRecord[] }).sources;
function registrySource(id: string): KnowledgeSource | null {
  const s = SOURCE_REGISTRY.find((x) => x.id === id);
  return s ? { title: s.name, url: s.url } : null;
}

// ---------------------------------------------------------------------------
// تمييز المصادر العامة (registry roots) عن المصادر المباشرة
// ---------------------------------------------------------------------------
// بعض مدخلات سجل المصادر هي صفحات جذرية عامة (مثل https://medlineplus.gov/) وليست
// مصدرًا مباشرًا لمعلومة بعينها. القاعدة: لا يجوز اعتبار مصدر عام دليلًا على معلومة
// ليس لها مصدر مباشر. لذلك نُسقط هذه الروابط من مصادر العنصر، ونستبعد أي عنصر لا
// يبقى له مصدر مباشر (حتى لا نُمرّر معرفة بلا مصدر إلى Gemini).
function normalizeUrl(url: string): string {
  return String(url ?? '')
    .trim()
    .toLowerCase()
    .replace(/\/+$/, '');
}
const GENERIC_SOURCE_URLS = new Set<string>(SOURCE_REGISTRY.map((s) => normalizeUrl(s.url)));
function isGenericSourceUrl(url: string): boolean {
  return GENERIC_SOURCE_URLS.has(normalizeUrl(url));
}

// ---------------------------------------------------------------------------
// الأنواع (Contracts)
// ---------------------------------------------------------------------------
export type KnowledgeCategory =
  | 'bone'
  | 'joint'
  | 'cartilage'
  | 'bursa'
  | 'muscle'
  | 'fascia'
  | 'tendon'
  | 'ligament'
  | 'nerve'
  | 'vessel'
  | 'organ'
  | 'gland'
  | 'lymph'
  | 'membrane'
  | 'space'
  | 'soft_tissue'
  | 'condition'
  | 'symptom'
  | 'region';

export interface KnowledgeSource {
  title: string;
  url: string;
}

export interface KnowledgeItem {
  id: string;
  kind: 'condition' | 'symptom' | 'structure' | 'region';
  category: KnowledgeCategory;
  /** الاسم مُترجَم بلغة المستخدم. */
  name: string;
  /** الوصف/الملخص مُترجَم. */
  description: string;
  /** نص Red Flags مُترجَم ('' إن لم توجد). */
  redFlags: string;
  hasRedFlags: boolean;
  regions: string[];
  /** مصدر كل معلومة (دائمًا غير فارغ). */
  sources: KnowledgeSource[];
  medlinePlusUrl: string;
  icd10: string | null;
  doid: string | null;
  score: number;
  matchedTerms: string[];
}

export interface KnowledgeResult {
  status: 'ok' | 'no_reliable_knowledge';
  /** يساوي no_reliable_knowledge عند غياب معرفة موثوقة، وإلا null. */
  sentinel: typeof NO_RELIABLE_KNOWLEDGE | null;
  query: string;
  language: Language;
  items: KnowledgeItem[];
  /** التصنيفات التشريحية التي غطّتها العناصر المسترجَعة. */
  categories: KnowledgeCategory[];
}

export interface RetrievalOptions {
  maxItems?: number;
  minConditionScore?: number;
  minContextScore?: number;
  includeStructures?: boolean;
  includeRegions?: boolean;
  includeSymptoms?: boolean;
}

// ---------------------------------------------------------------------------
// تطبيع نصّي محلي (لا نُعدّل المكتبة الأصلية؛ نعيد استخدام بياناتها فقط)
// ---------------------------------------------------------------------------
const AR_DIACRITICS = /[\u0617-\u061A\u064B-\u0652\u0670\u06D6-\u06ED]/g;

function normalizeText(input: string): string {
  return String(input ?? '')
    .toLowerCase()
    .replace(AR_DIACRITICS, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ئ/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenize(input: string): string[] {
  return normalizeText(input).split(' ').filter(Boolean);
}

// ---------------------------------------------------------------------------
// إزالة كلمات الوظيفة (Stopwords) العربية/المصرية الشائعة قبل المطابقة.
// السبب: كلمات مثل "في/من/على/عندي" تُطابَق كتوكنات في مكتبة المشروع فتنتج
// نتائج وهمية عبر حالات كثيرة (false positives). إزالتها ترفع دقة الاسترجاع
// دون تعديل المكتبة الأصلية.
// ---------------------------------------------------------------------------
const AR_STOPWORDS = new Set<string>([
  'في', 'من', 'على', 'عن', 'الي', 'مع', 'هذا', 'هذه', 'ذلك', 'تلك', 'ده', 'دي', 'دا', 'دول',
  'التي', 'الذي', 'اللي', 'يا', 'ثم', 'قد', 'ما', 'هل', 'كان', 'كانت', 'يكون', 'تكون',
  'بين', 'حتى', 'لكن', 'بس', 'كمان', 'و', 'او', 'ان', 'لم', 'لن', 'كل', 'بعض',
  'عند', 'عندي', 'عندى', 'لدي', 'عندنا', 'عندك', 'عندهم', 'عندها',
  'انا', 'هو', 'هي', 'نحن', 'هم', 'انت', 'انتي', 'اذا', 'كما', 'اي', 'ايه', 'اى',
  'ليه', 'ازاي', 'امتى', 'فين', 'هنا', 'هناك', 'برضو', 'يعني', 'خالص', 'اوي', 'قوي',
  'جدا', 'شويه', 'حبتين', 'ممكن', 'عايز', 'عاوز', 'محتاج', 'بسال', 'بسأل', 'قولي', 'قول',
  'معلش', 'طيب', 'اوك', 'اوكي', 'حاسس', 'حاسه', 'بحس', 'بيوجعني', 'وجعني', 'بيوجع',
  'يؤلمني', 'يؤلم', 'عندما', 'لان', 'لأن', 'كي', 'حيث', 'ايضا', 'أيضا', 'فقط', 'اكثر', 'أكثر',
]);

/** يُرجع نصًّا منظَّفًا من كلمات الوظيفة (يبقى المعنى الطبي: وجع/ألم/اسم العضو...). */
function cleanQuery(input: string): string {
  const tokens = tokenize(input).filter((t) => !AR_STOPWORDS.has(t));
  return tokens.join(' ');
}

// ---------------------------------------------------------------------------
// بوابة الموثوقية على مستوى الأدلة (Evidence gate):
// نرفض المطابقات الضعيفة التي تعتمد فقط على تشابه جزئي/تقريبي (مثل "هلا" داخل
// "الهلالي"، أو "الحال" داخل "الحالب") حتى لا نُمرّر معرفة غير موثوقة إلى Gemini.
// ---------------------------------------------------------------------------
const WEAK_TERM_PREFIXES = ['name_sub', 'summary', 'generic_penalty', 'name_fuzzy', 'keyword_fuzzy'];

/** هل توجد أدلة مطابقة قوية (توكن/اسم/كلمة مفتاحية/منطقة) وليست مجرد تشابه جزئي؟ */
function hasStrongConditionEvidence(matchedTerms: string[], queryLength: number): boolean {
  return matchedTerms.some((term) => {
    if (WEAK_TERM_PREFIXES.some((p) => term.startsWith(p))) return false;
    // "name_includes" = الاستعلام كامل داخل اسم الحالة؛ لا يُعتد به للاستعلامات القصيرة.
    if (term === 'name_includes' && queryLength < 4) return false;
    return true;
  });
}

function truncate(text: string, max: number): string {
  const t = String(text ?? '').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

// ---------------------------------------------------------------------------
// بناء عنصر معرفة من حالة مرضية (المصادر مضمونة)
// ---------------------------------------------------------------------------
function conditionItem(result: { condition: MedicalCondition; score: number; matchedTerms: string[] }, language: Language): KnowledgeItem {
  const c = result.condition;
  // مصادر مباشرة فقط: نُسقط الروابط الجذرية العامة (مثل https://medlineplus.gov/).
  const sources: KnowledgeSource[] = (c.sources ?? [])
    .filter((s) => s && typeof s.url === 'string' && s.url.length > 0)
    .filter((s) => !isGenericSourceUrl(s.url))
    .map((s) => ({ title: s.title, url: s.url }));
  // رابط MedlinePlus المباشر (صفحة المرض تحديدًا) مصدر مباشر، بشرط ألّا يكون رابطًا عامًا.
  if (
    c.medlinePlusUrl &&
    !isGenericSourceUrl(c.medlinePlusUrl) &&
    !sources.some((s) => s.url === c.medlinePlusUrl)
  ) {
    sources.push({ title: `MedlinePlus — ${localize(c.name, 'en')}`, url: c.medlinePlusUrl });
  }
  // لا يوجد fallback إلى مصدر عام: إن لم يتبقَّ مصدر مباشر يبقى العنصر بلا مصدر
  // ويُستبعد لاحقًا في retrieveMedicalKnowledge (لا نُمرّر معرفة بلا مصدر إلى Gemini).
  return {
    id: c.id,
    kind: 'condition',
    category: 'condition',
    name: localize(c.name, language),
    description: localize(c.summary, language),
    redFlags: localize(c.redFlags, language),
    hasRedFlags: hasRedFlags(c),
    regions: [...(c.regions ?? [])],
    sources,
    medlinePlusUrl: c.medlinePlusUrl ?? '',
    icd10: c.icd10 ?? null,
    doid: c.doid ?? null,
    score: result.score,
    matchedTerms: result.matchedTerms,
  };
}

// ---------------------------------------------------------------------------
// مطابقة البنى التشريحية (عظم/مفصل/عضلة/وتر/رباط/عصب/وعاء/عضو...)
// ---------------------------------------------------------------------------
interface StructureMatch {
  structure: AnatomicalStructure;
  score: number;
  matchedTerms: string[];
}

function matchStructures(query: string): StructureMatch[] {
  const nq = normalizeText(query);
  if (!nq) return [];
  const qTokens = new Set(tokenize(query).filter((t) => t.length >= 3));
  const out: StructureMatch[] = [];
  for (const s of getAllStructures()) {
    const ar = normalizeText(s.label.ar);
    const en = normalizeText(s.label.en);
    let score = 0;
    const matchedTerms: string[] = [];
    if (ar && nq.includes(ar)) {
      score += 400;
      matchedTerms.push('structure_label_ar');
    }
    if (en && nq.includes(en)) {
      score += 400;
      matchedTerms.push('structure_label_en');
    }
    for (const t of qTokens) {
      const arWords = ar.split(' ');
      const enWords = en.split(' ');
      if (arWords.includes(t)) {
        score += 150;
        matchedTerms.push(`ar_token:${t}`);
      } else if (enWords.includes(t)) {
        score += 150;
        matchedTerms.push(`en_token:${t}`);
      } else if (t.length >= 4 && (ar.includes(t) || en.includes(t))) {
        score += 60;
        matchedTerms.push(`sub:${t}`);
      }
    }
    if (score > 0) out.push({ structure: s, score, matchedTerms });
  }
  return out.sort((a, b) => b.score - a.score);
}

function structureItem(match: StructureMatch, language: Language): KnowledgeItem {
  const s = match.structure;
  const sources: KnowledgeSource[] = [];
  const z = registrySource('z-anatomy');
  const b = registrySource('bodyparts3d');
  if (z) sources.push(z);
  if (b) sources.push(b);
  return {
    id: s.id,
    kind: 'structure',
    category: (s.type as KnowledgeCategory) ?? 'soft_tissue',
    name: localizePair(s.label, language),
    description: `${localizePair(s.label, language)} (${s.type}) — ${s.subRegionId}`,
    redFlags: '',
    hasRedFlags: false,
    regions: [s.subRegionId],
    sources,
    medlinePlusUrl: '',
    icd10: null,
    doid: null,
    score: match.score,
    matchedTerms: match.matchedTerms,
  };
}

// ---------------------------------------------------------------------------
// مطابقة مناطق الألم وأوصافها (من التصنيف التشريحي)
// ---------------------------------------------------------------------------
interface RegionMatch {
  id: string;
  labelAr: string;
  labelEn: string;
  score: number;
  matchedTerms: string[];
}

function matchRegions(query: string): RegionMatch[] {
  const nq = normalizeText(query);
  if (!nq) return [];
  const qTokens = new Set(tokenize(query).filter((t) => t.length >= 3));
  const out: RegionMatch[] = [];
  const consider = (id: string, labelAr: string, labelEn: string) => {
    const ar = normalizeText(labelAr);
    const en = normalizeText(labelEn);
    let score = 0;
    const matchedTerms: string[] = [];
    if (ar && nq.includes(ar)) {
      score += 350;
      matchedTerms.push('region_label_ar');
    }
    if (en && nq.includes(en)) {
      score += 350;
      matchedTerms.push('region_label_en');
    }
    for (const t of qTokens) {
      if (ar.split(' ').includes(t) || en.split(' ').includes(t)) {
        score += 150;
        matchedTerms.push(`region_token:${t}`);
      }
    }
    if (score > 0) out.push({ id, labelAr, labelEn, score, matchedTerms });
  };
  for (const r of getTaxonomy()) {
    consider(r.id, r.label.ar, r.label.en);
    for (const sr of r.subRegions) consider(sr.id, sr.label.ar, sr.label.en);
  }
  return out.sort((a, b) => b.score - a.score);
}

function regionItem(match: RegionMatch, language: Language): KnowledgeItem {
  const sources: KnowledgeSource[] = [];
  const z = registrySource('z-anatomy');
  if (z) sources.push(z);
  return {
    id: `region:${match.id}`,
    kind: 'region',
    category: 'region',
    name: language === 'en' ? match.labelEn : match.labelAr,
    description: language === 'en' ? match.labelEn : match.labelAr,
    redFlags: '',
    hasRedFlags: false,
    regions: [match.id],
    sources,
    medlinePlusUrl: '',
    icd10: null,
    doid: null,
    score: match.score,
    matchedTerms: match.matchedTerms,
  };
}

// ---------------------------------------------------------------------------
// مطابقة الأعراض (HPO)
// ---------------------------------------------------------------------------
interface SymptomMatch {
  symptom: MedicalSymptom;
  score: number;
  matchedTerms: string[];
}

function matchSymptoms(query: string): SymptomMatch[] {
  const nq = normalizeText(query);
  if (!nq) return [];
  const qTokens = new Set(tokenize(query).filter((t) => t.length >= 3));
  const out: SymptomMatch[] = [];
  for (const s of getAllSymptoms()) {
    const ar = normalizeText(s.name.ar);
    const en = normalizeText(s.name.en);
    const fr = normalizeText(s.name.fr);
    const descAr = normalizeText(s.description.ar);
    let score = 0;
    const matchedTerms: string[] = [];
    if (ar && nq.includes(ar)) {
      score += 400;
      matchedTerms.push('symptom_label_ar');
    }
    if (en && nq.includes(en)) {
      score += 350;
      matchedTerms.push('symptom_label_en');
    }
    if (fr && nq.includes(fr)) {
      score += 300;
      matchedTerms.push('symptom_label_fr');
    }
    for (const t of qTokens) {
      if (ar.split(' ').includes(t)) {
        score += 150;
        matchedTerms.push(`symptom_ar_token:${t}`);
      } else if (en.split(' ').includes(t)) {
        score += 120;
        matchedTerms.push(`symptom_en_token:${t}`);
      } else if (t.length >= 4 && (descAr.includes(t) || ar.includes(t))) {
        score += 50;
        matchedTerms.push(`symptom_sub:${t}`);
      }
    }
    if (score > 0) out.push({ symptom: s, score, matchedTerms });
  }
  return out.sort((a, b) => b.score - a.score);
}

function symptomItem(match: SymptomMatch, language: Language): KnowledgeItem {
  const s = match.symptom;
  const sources: KnowledgeSource[] = [];
  const hpo = registrySource('hpo');
  if (hpo) sources.push(hpo);
  return {
    id: s.id,
    kind: 'symptom',
    category: 'symptom',
    name: localize(s.name, language),
    description: localize(s.description, language),
    redFlags: '',
    hasRedFlags: Boolean(s.redFlag),
    regions: [...(s.regions ?? [])],
    sources,
    medlinePlusUrl: '',
    icd10: null,
    doid: null,
    score: match.score,
    matchedTerms: match.matchedTerms,
  };
}

// ---------------------------------------------------------------------------
// الاسترجاع الرئيسي
// ---------------------------------------------------------------------------
/**
 * يسترجع المعرفة الطبية المناسبة لسؤال المستخدم من بيانات المشروع فقط.
 * يُعيد قائمة محدودة من العناصر مع مصدر كل معلومة، أو القيمة الحسّاسة
 * {@link NO_RELIABLE_KNOWLEDGE} عند غياب معرفة موثوقة.
 */
export function retrieveMedicalKnowledge(
  query: string,
  language: Language = 'ar',
  options: RetrievalOptions = {},
): KnowledgeResult {
  const maxItems = options.maxItems ?? MAX_ITEMS;
  const minCondition = options.minConditionScore ?? MIN_CONDITION_SCORE;
  const minContext = options.minContextScore ?? MIN_CONTEXT_SCORE;
  const trimmed = String(query ?? '').trim();
  const empty: KnowledgeResult = {
    status: NO_RELIABLE_KNOWLEDGE,
    sentinel: NO_RELIABLE_KNOWLEDGE,
    query: trimmed,
    language,
    items: [],
    categories: [],
  };
  if (trimmed.length < 2) return empty;

  // نُزيل كلمات الوظيفة قبل المطابقة (دقة أعلى، بلا تعديل على المكتبة الأصلية).
  const cleaned = cleanQuery(trimmed);
  if (cleaned.length < 2) return empty;

  // 1) الحالات المرضية (المرجع الأساسي) — مع المصادر و Red Flags
  //    نستبعد أي حالة بلا مصدر مباشر (لا نعتبر المصدر العام دليلًا) حتى لا نُمرّر
  //    إلى Gemini معلومة طبية بلا مصدر يمكن الاستناد إليه.
  const conditionMatches = smartSearch(cleaned, getAllConditions(), maxItems * 2)
    .filter((r) => r.score >= minCondition && hasStrongConditionEvidence(r.matchedTerms, cleaned.length))
    .map((r) => conditionItem(r, language))
    .filter((item) => item.sources.length > 0);

  // 2) البنى التشريحية (عظم/مفصل/عضلة/وتر/رباط/عصب/وعاء/عضو...)
  const structureMatches = options.includeStructures === false
    ? []
    : matchStructures(cleaned)
        .filter((m) => m.score >= minContext)
        .map((m) => structureItem(m, language));

  // 3) مناطق الألم وأوصافها
  const regionMatches = options.includeRegions === false
    ? []
    : matchRegions(cleaned)
        .filter((m) => m.score >= minContext)
        .map((m) => regionItem(m, language));

  // 4) الأعراض (HPO)
  const symptomMatches = options.includeSymptoms === false
    ? []
    : matchSymptoms(cleaned)
        .filter((m) => m.score >= minContext)
        .map((m) => symptomItem(m, language));

  const items = [...conditionMatches, ...structureMatches, ...regionMatches, ...symptomMatches]
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems);

  if (items.length === 0) return empty;

  const categories = [...new Set(items.map((i) => i.category))];
  return {
    status: 'ok',
    sentinel: null,
    query: trimmed,
    language,
    items,
    categories,
  };
}

// ---------------------------------------------------------------------------
// صياغة المعرفة المسترجَعة إلى كتلة نصية مضغوطة (المعلومة + المصدر)
// ---------------------------------------------------------------------------
/**
 * يبني كتلة نصية مضغوطة تحتوي المعلومة + المصدر لكل عنصر مسترجَع، أو القيمة
 * الحسّاسة no_reliable_knowledge. تُمرَّر هذه الكتلة إلى Gemini.
 */
export function buildKnowledgeContext(result: KnowledgeResult, language: Language = 'ar'): string {
  if (result.status === NO_RELIABLE_KNOWLEDGE || result.items.length === 0) {
    return [
      `status: ${NO_RELIABLE_KNOWLEDGE}`,
      'لا توجد معرفة طبية موثوقة في مكتبة المشروع لهذا السؤال. لا تخترع أي معلومة طبية.',
    ].join('\n');
  }
  const lines = result.items.map((item, index) => {
    const src = item.sources.length
      ? item.sources.map((s) => `${s.title} (${s.url})`).join(' ; ')
      : '—';
    const rf = item.hasRedFlags && item.redFlags ? ` | RedFlags: ${truncate(item.redFlags, MAX_REDFLAG_TEXT)}` : '';
    const ids = [item.icd10 ? `ICD-10 ${item.icd10}` : '', item.doid ? `DOID ${item.doid}` : '']
      .filter(Boolean)
      .join(' · ');
    const idPart = ids ? ` [${ids}]` : '';
    return `[${index + 1}] (${item.kind}/${item.category}) ${item.name}${idPart} — ${truncate(item.description, MAX_TEXT)}${rf} | المصدر: ${src}`;
  });
  return [`status: ok`, `language: ${language}`, `items: ${result.items.length}`, ...lines].join('\n');
}

// ---------------------------------------------------------------------------
// دمج طبقة المعرفة مع تعليمات النظام الخاصة بـ Gemini (نقطة الربط الفعلية)
// ---------------------------------------------------------------------------
/**
 * يُرجع تعليمات النظام مع كتلة "طبقة المعرفة" المبنية من نتيجة الاسترجاع.
 * هذا هو الجسر بين Retrieval و Gemini: الـPrompt الذي يُرسَل إلى generateObject
 * يحتوي فقط على المعرفة المسترجَعة + مصادرها، مع منع اختراع أي معلومة طبية.
 */
export function buildGroundedSystemPrompt(
  basePrompt: string,
  result: KnowledgeResult,
  language: Language = 'ar',
): string {
  const block = buildKnowledgeContext(result, language);
  const groundingRules = [
    '',
    '=== KNOWLEDGE LAYER (ground truth — from the project Medical Library) ===',
    'قواعد إلزامية (لا تُخالَف):',
    '- استخدم المعلومات المسترجَعة أدناه فقط في أي معلومة طبية. لا تخترع أي معلومة طبية غير موجودة هنا.',
    '- اذكر مصدر كل معلومة طبية تذكرها (اسم المصدر + الرابط).',
    `- إذا كان status = ${NO_RELIABLE_KNOWLEDGE} فلا تقدّم أي معلومة طبية؛ وضّح أنك لا تملك معرفة موثوقة واقترح استشارة مختص.`,
    '- هذه الطبقة للمعرفة الطبية فقط، ومنفصلة تمامًا عن TCM/الوخز بالإبر.',
    '- لا تُغيّر عقد الـJSON المطلوب ولا أنواع الإجراءات المسموحة.',
    '',
    '--- retrieved knowledge ---',
    block,
    '--- end retrieved knowledge ---',
  ].join('\n');
  return `${basePrompt}${groundingRules}`;
}

// ---------------------------------------------------------------------------
// التغطية: إثبات أن طبقة المعرفة تغطي كل التصنيفات المطلوبة
// ---------------------------------------------------------------------------
export interface KnowledgeCoverage {
  bones_joints: number;
  muscles: number;
  tendons_ligaments: number;
  nerves: number;
  organs: number;
  blood_vessels: number;
  pain_regions: number;
  red_flags: number;
}

const STRUCTURE_BUCKETS: Record<keyof Omit<KnowledgeCoverage, 'pain_regions' | 'red_flags'>, string[]> = {
  bones_joints: ['bone', 'joint', 'cartilage', 'bursa'],
  muscles: ['muscle', 'fascia'],
  tendons_ligaments: ['tendon', 'ligament'],
  nerves: ['nerve'],
  organs: ['organ', 'gland'],
  blood_vessels: ['vessel'],
};

/** يُرجع عدد عناصر المعرفة المتاحة في كل تصنيف مطلوب (لإثبات التغطية). */
export function getKnowledgeCoverage(): KnowledgeCoverage {
  const structures = getAllStructures();
  const countTypes = (types: string[]) => structures.filter((s) => types.includes(s.type)).length;
  const regions = getTaxonomy().reduce((n, r) => n + 1 + r.subRegions.length, 0);
  const conditionsWithRedFlags = getAllConditions().filter((c) => hasRedFlags(c)).length;
  const symptomsWithRedFlag = getAllSymptoms().filter((s) => s.redFlag).length;
  return {
    bones_joints: countTypes(STRUCTURE_BUCKETS.bones_joints),
    muscles: countTypes(STRUCTURE_BUCKETS.muscles),
    tendons_ligaments: countTypes(STRUCTURE_BUCKETS.tendons_ligaments),
    nerves: countTypes(STRUCTURE_BUCKETS.nerves),
    organs: countTypes(STRUCTURE_BUCKETS.organs),
    blood_vessels: countTypes(STRUCTURE_BUCKETS.blood_vessels),
    pain_regions: regions,
    red_flags: conditionsWithRedFlags + symptomsWithRedFlag,
  };
}
