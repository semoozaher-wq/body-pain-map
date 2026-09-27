// ============================================================================
// services/medical/diseaseLibrary.ts
// ----------------------------------------------------------------------------
// مكتبة الأمراض والأعراض المحلية (offline) — DOID + HPO + ICD-10 + MedlinePlus
// ----------------------------------------------------------------------------
// النسخة دي فيها محرك بحث ذكي مبني من الصفر:
//   - تطبيع النص العربي (ضهري = ظهري، ألم = وجع، إلخ)
//   - إزالة السوابق واللواحق (بضهري → ضهر)
//   - بحث تقريبي (Fuzzy) للأخطاء الإملائية
//   - قاموس كلمات مفتاحية وعامية مصرية لكل حالة
//   - خوارزمية ترتيب (Scoring) — النتائج الأهم أولاً
//   - (v2) دعم الحالات العامة (M79.1 وغيرها) + مكافآت للـ colloquial المطابق
// ============================================================================

import diseasesData from '../../data/medical/diseases.json';
import organConditionsData from '../../data/medical/organConditions.json';
import regionalConditionsData from '../../data/medical/regionalConditions.json';
import symptomsData from '../../data/medical/symptoms.json';

// ============================================================================
// Types
// ============================================================================

export type Language = 'ar' | 'en' | 'fr';
export type LocalizedText = { ar: string; en: string; fr: string };

export interface MedicalCondition {
  id: string;
  doid: string | null;
  doidStatus?: 'mapped' | 'not-mapped';
  batch?: string;
  icd10: string;
  name: LocalizedText;
  summary: LocalizedText;
  muscleGroups: string[];
  regions: string[];
  taxonomy?: { subRegion: string; structures: string[] };
  symptoms: string[];
  organs?: string[];
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

export interface SearchResult {
  condition: MedicalCondition;
  score: number;
  matchedTerms: string[];
}

// ============================================================================
// البيانات الأساسية
// ============================================================================

const BASE_CONDITIONS = (diseasesData as { conditions: MedicalCondition[] }).conditions;
const ORGAN_CONDITIONS = (organConditionsData as { conditions: MedicalCondition[] }).conditions;
const REGIONAL_CONDITIONS = (regionalConditionsData as { conditions: MedicalCondition[] }).conditions;

/** حالات منتشرة (فيبروميالجيا، ألم عضلي عام...) — تُخفَّض درجتها عند وجود شكوى موضعية. */
const DIFFUSE_IDS = new Set(['doid:1490', 'doid:8505', 'doid:8505-doms']);

const CONDITIONS: MedicalCondition[] = [
  ...BASE_CONDITIONS,
  ...ORGAN_CONDITIONS,
  ...REGIONAL_CONDITIONS,
].map((c) => (DIFFUSE_IDS.has(c.id) ? { ...c, diffuse: true } : c));

const SYMPTOMS = (symptomsData as { symptoms: MedicalSymptom[] }).symptoms;

// ============================================================================
// قاموس الكلمات المفتاحية والعامية المصرية
// ----------------------------------------------------------------------------
// مفتاح كل حالة = الـ id الحقيقي بتاعها في diseases.json
// لو لقيت id مختلف، عدّل المفتاح بس.
// ============================================================================

interface KeywordEntry {
  keywords: string[];
  colloquial: string[];
}

const KEYWORDS_MAP: Record<string, KeywordEntry> = {
  // ===== ألم أسفل الظهر =====
  'doid:6354': {
    keywords: [
      'ألم', 'وجع', 'شد', 'تعب', 'ضغط', 'حرقة', 'تقلص',
      'ظهر', 'ضهر', 'أسفل الظهر', 'أسفل ضهري', 'وسط ضهري', 'وسط ظهري',
      'فقرات', 'عمود فقري', 'حوض', 'قطنية', 'أسفل الحوض',
      'back pain', 'low back', 'lumbar', 'lumbago', 'backache',
    ],
    colloquial: [
      'ضهري بيوجعني',
      'وجع في ضهري',
      'حاسس بوجع في أسفل ضهري',
      'ضهري تعبان',
      'مش قادر أقف من وجع ضهري',
      'وجع في وسط ضهري',
      'حاسس بشد في ضهري',
    ],
  },

  // ===== ألم الرقبة =====
  'doid:1001167': {
    keywords: [
      'رقبة', 'رقبتي', 'الرقبة', 'وجع رقبة', 'شد رقبة', 'تقلص رقبة',
      'فقرات الرقبة', 'الفقرات العنقية', 'عنقي', 'عنق', 'تصلب الرقبة',
      'neck pain', 'cervicalgia', 'cervical', 'neck ache', 'stiff neck',
    ],
    colloquial: [
      'رقبتي بتوجعني',
      'وجع في رقبتي',
      'رقبتي مش قادر ألفها',
      'حاسس بشد في رقبتي',
      'وجع في الرقبة من النوم',
    ],
  },

  // ===== إصابة الكفة المدورة =====
  'doid:0116': {
    keywords: [
      'كتف', 'كتفي', 'الكتف', 'وجع كتف', 'شد كتف', 'تقلص كتف',
      'الكفة المدورة', 'الكتف الأيسر', 'الكتف الأيمن', 'كتف متجمد',
      'rotator cuff', 'shoulder pain', 'frozen shoulder', 'shoulder',
    ],
    colloquial: [
      'كتفي بتوجعني',
      'وجع في كتفي',
      'مش قادر أرفع إيدي',
      'كتفي مش قادر أحركه',
      'حاسس بشد في كتفي',
    ],
  },

  // ===== خشونة الركبة =====
  'doid:839': {
    keywords: [
      'ركبة', 'ركبتي', 'الركبة', 'وجع ركبة', 'شد ركبة',
      'خشونة الركبة', 'الغضروف', 'غضروف الركبة', 'المفصل', 'مفصل الركبة',
      'knee pain', 'knee osteoarthritis', 'knee', 'gonarthrosis',
    ],
    colloquial: [
      'ركبتي بتوجعني',
      'وجع في ركبتي',
      'ركبتي بتعمل صوت',
      'مش قادر أثني ركبتي',
      'ركبتي وارمة',
    ],
  },

  // ===== فيبروميالجيا =====
  'doid:8545': {
    keywords: [
      'فيبروميالجيا', 'ألم عضلي', 'ألم منتشر', 'تعب مزمن', 'إرهاق',
      'ألم في كل الجسم', 'وجع في كل حتة', 'إجهاد مزمن', 'ألم ليلي',
      'fibromyalgia', 'chronic pain', 'widespread pain', 'fatigue',
    ],
    colloquial: [
      'جسمي كله بيوجعني',
      'وجع في كل حتة',
      'تعبان طول الوقت',
      'حاسس بإرهاق مستمر',
      'جسمي مكسر',
    ],
  },

  // ===== الصداع النصفي (الشقيقة) =====
  'doid:6364': {
    keywords: [
      'صداع', 'صداع نصفي', 'الشقيقة', 'وجع راس', 'وجع في راسي',
      'ألم في الرأس', 'صداع شديد', 'غثيان', 'دوخة', 'حساسية للضوء',
      'migraine', 'headache', 'head pain', 'cephalgia',
    ],
    colloquial: [
      'راسي بتوجعني',
      'عندي صداع',
      'صداع نصفي',
      'حاسس بوجع في نص راسي',
      'الصداع مش بيروح',
    ],
  },

  // ===== الصداع التوتري =====
  'doid:14747': {
    keywords: [
      'صداع توتري', 'صداع', 'شد في الرقبة', 'ضغط في الرأس',
      'صداع من التوتر', 'صداع من الشغل', 'صداع خفيف مستمر',
      'tension headache', 'stress headache', 'headache',
    ],
    colloquial: [
      'صداع من الشغل',
      'حاسس بضغط في دماغي',
      'راسي تقيلة',
      'صداع من التوتر',
      'حاسس بشد في راسي',
    ],
  },

  // ===== عرق النسا / ألم جذور الأعصاب القطنية =====
  'doid:8505': {
    keywords: [
      'عرق النسا', 'ألم الساق', 'ألم ينزل', 'شد في الساق',
      'تنميل', 'ضغط على العصب', 'ألم الساق الأيسر', 'ألم الساق الأيمن',
      'ألم عصبي', 'جذور الأعصاب', 'انزلاق غضروفي',
      'sciatica', 'radiculopathy', 'nerve pain', 'lumbar radiculopathy',
    ],
    colloquial: [
      'وجع في ضهري بينزل على رجلي',
      'حاسس بتنميل في رجلي',
      'وجع في ضهري وبيوصل لساقي',
      'رجلي بتتنمّل',
      'حاسس بوجع في ساقي من ضهري',
    ],
  },

  // ===== شد / تقلص عضلي =====
  'doid:6314': {
    keywords: [
      'شد عضلي', 'تقلص', 'تشنج', 'تقلص عضلي', 'وجع عضلي',
      'شد في العضلة', 'تعب العضلة', 'تشنج عضلي', 'تقلصات',
      'muscle spasm', 'muscle cramps', 'spasm', 'cramp',
    ],
    colloquial: [
      'حاسس بتقلص في رجلي',
      'عضلاتي بتشد',
      'حاسس بشد في ضهري',
      'رجلي بتتقلص',
      'عضلاتي بتوجعني',
    ],
  },

  // ===== ألم العضلات (الميالجيا) M79.1 =====
  // ⚠️ دي حالة عامة — بنحطها هنا عشان نحدد كلماتها المفتاحية بدقة،
  // لكن الـ score بتاعها في smartSearch منخفض (generic: true).
  'doid:8483': {
    keywords: [
      'ألم عضلي', 'ألم في العضلات', 'ميالجيا', 'وجع عضلي', 'ألم عام',
      'ألم في كل العضلات', 'تعب عضلي',
      'myalgia', 'muscle pain', 'muscular pain',
    ],
    colloquial: [
      'عضلاتي بتوجعني',
      'جسمي كله بوجع',
      'حاسس بألم في عضلاتي',
    ],
  },

  // ===== حالات إضافية (احتياطي للتوافق مع diseases.json) =====
  'doid:10933': {
    keywords: [
      'التهاب المفاصل', 'روماتويد', 'التهاب المفصل الروماتويدي',
      'وجع في المفاصل', 'تورم المفاصل', 'التهاب المفاصل الرثياني',
      'rheumatoid arthritis', 'arthritis',
    ],
    colloquial: [
      'مفاصلي بتوجعني',
      'مفاصلي وارمة',
      'وجع في مفاصلي',
    ],
  },

  'doid:11483': {
    keywords: [
      'الانزلاق الغضروفي', 'الديسك', 'انزلاق الديسك', 'انزلاق الفقرات',
      'الانزلاق الغضروفي القطني', 'انزلاق غضروفي عنقي',
      'herniated disc', 'disc herniation', 'slipped disc',
    ],
    colloquial: [
      'عندي ديسك في ضهري',
      'الديسك ضاغط على العصب',
      'وجع في ضهري من الديسك',
    ],
  },

  'doid:0055': {
    keywords: [
      'النفق الرسغي', 'متلازمة النفق الرسغي', 'التنميل في الإيد',
      'تنميل الأصابع', 'وجع في الرسغ', 'ضعف الإيد',
      'carpal tunnel', 'carpal tunnel syndrome', 'wrist pain',
    ],
    colloquial: [
      'إيدي بتتنمّل',
      'رسغي بوجعني',
      'صوابعي بتتنمّل',
    ],
  },

  'doid:0115': {
    keywords: [
      'التهاب الأوتار', 'التهاب الوتر', 'وجع في الوتر',
      'التهاب وتر أخيل', 'التهاب أوتار الكتف',
      'tendinitis', 'tendonitis', 'tendon pain',
    ],
    colloquial: [
      'وتري بوجعني',
      'حاسس بألم في الوتر',
      'وجع في وتر رجلي',
    ],
  },

  'doid:0084': {
    keywords: [
      'خشونة المفاصل', 'خشونة الركبة', 'خشونة الورك',
      'الفصال العظمي', 'الفصال', 'تآكل الغضروف',
      'osteoarthritis', 'OA', 'degenerative joint disease',
    ],
    colloquial: [
      'عندي خشونة في ركبتي',
      'مفاصلي بتطلع صوت',
      'ركبتي بتفرقع',
    ],
  },
};

// ============================================================================
// حالات عامة (Generic) — الـ score بتاعها يُخفَّض دايمًا عشان ما تطغاش
// على الحالات المحددة. مفتاحها الـ id بتاع الحالة.
// ============================================================================
const GENERIC_CONDITION_IDS = new Set<string>([
  'doid:8483', // ألم العضلات (الميالجيا) — M79.1
  'doid:8545', // فيبروميالجيا — عامة
]);

// ============================================================================
// أدوات معالجة النص العربي
// ============================================================================

/**
 * تطبيع النص العربي:
 * - توحيد الألف: أ إ آ ٱ → ا
 * - توحيد الهمزة: ؤ → و ، ئ → ي
 * - توحيد التاء المربوطة: ة → ه
 * - توحيد الألف المقصورة: ى → ي
 * - إزالة التشكيل والتطويل
 * - تحويل الأرقام العربية إلى إنجليزية
 * - إزالة الترقيم
 * - تحويل الإنجليزي إلى lowercase
 */
function normalizeArabic(text: string): string {
  if (!text) return '';

  let n = text;

  // إزالة التشكيل (Tashkeel)
  n = n.replace(/[\u064B-\u065F\u0670]/g, '');

  // إزالة التطويل
  n = n.replace(/\u0640/g, '');

  // توحيد الألف
  n = n.replace(/[أإآٱ]/g, 'ا');

  // توحيد الهمزة
  n = n.replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');

  // توحيد التاء المربوطة
  n = n.replace(/ة/g, 'ه');

  // توحيد الألف المقصورة
  n = n.replace(/ى/g, 'ي');

  // الأرقام العربية → إنجليزية
  n = n.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));

  // إزالة الترقيم
  n = n.replace(/[.,!?؟،؛:؛"'`~@#$%^&*()_+=\[\]{}|\\/<>]/g, ' ');

  // توحيد المسافات
  n = n.replace(/\s+/g, ' ').trim();

  // lowercase للإنجليزي
  n = n.toLowerCase();

  return n;
}

/** تقسيم النص إلى كلمات بعد التطبيع. */
function tokenize(text: string): string[] {
  const n = normalizeArabic(text);
  if (!n) return [];
  return n.split(' ').filter((w) => w.length > 1);
}

/**
 * إزالة السوابق واللواحق العربية:
 * "والضهر" → "ضهر"، "بضهري" → "ضهر"
 */
function stripAffixes(word: string): string {
  let w = word;

  const prefixes = ['وال', 'بال', 'فال', 'كال', 'لل', 'ال', 'و', 'ف', 'ب', 'ك', 'ل'];
  for (const p of prefixes) {
    if (w.startsWith(p) && w.length - p.length >= 3) {
      w = w.slice(p.length);
      break;
    }
  }

  const suffixes = ['ات', 'ين', 'ون', 'ها', 'هم', 'هن', 'كم', 'كن', 'نا', 'ي', 'ه', 'ك'];
  for (const s of suffixes) {
    if (w.endsWith(s) && w.length - s.length >= 3) {
      w = w.slice(0, -s.length);
      break;
    }
  }

  return w;
}

/** مسافة Levenshtein (للأخطاء الإملائية). */
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

/** نسبة التشابه بين كلمتين (0 → 1). */
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const longer = a.length > b.length ? a : b;
  const shorter = a.length > b.length ? b : a;
  if (longer.length === 0) return 1;
  return (longer.length - levenshtein(longer, shorter)) / longer.length;
}

// ============================================================================
// محرك البحث الذكي
// ============================================================================

/**
 * حساب درجة المطابقة لحالة واحدة.
 * كل وزن مضبوط عشان النتيجة الأهم تطلع فوق.
 *
 * v2: أضفنا مكافآت إضافية للـ colloquial المطابق، وعقوبة للحالات العامة
 * (GENERIC_CONDITION_IDS) عشان ما تطغاش على الحالات المحددة.
 */
function scoreCondition(
  condition: MedicalCondition,
  normalizedQuery: string,
  queryTokens: string[],
): SearchResult {
  let score = 0;
  const matchedTerms: string[] = [];

  // نصوص جاهزة للتطابق
  const nameAr = normalizeArabic(condition.name.ar);
  const nameEn = condition.name.en.toLowerCase();
  const nameFr = condition.name.fr.toLowerCase();
  const summaryAr = normalizeArabic(condition.summary.ar);

  // الكلمات المفتاحية من القاموس
  const kwEntry = KEYWORDS_MAP[condition.id];
  const keywords = kwEntry ? kwEntry.keywords.map(normalizeArabic) : [];
  const colloquial = kwEntry ? kwEntry.colloquial.map(normalizeArabic) : [];

  // -------------------------------------------------------------------------
  // 1) مطابقة الجملة الكاملة (أعلى وزن)
  // -------------------------------------------------------------------------
  if (normalizedQuery === nameAr) {
    score += 1000;
    matchedTerms.push('name_exact');
  }
  if (colloquial.some((c) => c === normalizedQuery)) {
    score += 900;
    matchedTerms.push('colloquial_exact');
  }
  if (keywords.some((k) => k === normalizedQuery)) {
    score += 800;
    matchedTerms.push('keyword_exact');
  }

  // -------------------------------------------------------------------------
  // 2) مطابقة الجملة كجزء من النص
  // -------------------------------------------------------------------------
  if (nameAr.includes(normalizedQuery)) {
    score += 500;
    matchedTerms.push('name_includes');
  }
  if (colloquial.some((c) => c.includes(normalizedQuery))) {
    score += 450;
    matchedTerms.push('colloquial_includes');
  }
  if (keywords.some((k) => k.includes(normalizedQuery))) {
    score += 400;
    matchedTerms.push('keyword_includes');
  }
  if (nameEn.includes(normalizedQuery) || nameFr.includes(normalizedQuery)) {
    score += 350;
    matchedTerms.push('name_en_fr');
  }
  if (summaryAr.includes(normalizedQuery)) {
    score += 100;
    matchedTerms.push('summary');
  }

  // -------------------------------------------------------------------------
  // 3) مطابقة الكلمات المنفصلة (Token-based)
  // -------------------------------------------------------------------------
  for (const token of queryTokens) {
    const stripped = stripAffixes(token);

    // مطابقة تامة
    if (nameAr.split(' ').some((w) => w === token || w === stripped)) {
      score += 150;
      matchedTerms.push(`name_token:${token}`);
    }
    if (keywords.some((k) => k.split(' ').includes(token) || k.split(' ').includes(stripped))) {
      score += 120;
      matchedTerms.push(`keyword_token:${token}`);
    }
    if (colloquial.some((c) => c.split(' ').includes(token) || c.split(' ').includes(stripped))) {
      score += 100;
      matchedTerms.push(`colloquial_token:${token}`);
    }

    // مطابقة جزئية
    if (nameAr.includes(token) || (stripped.length >= 3 && nameAr.includes(stripped))) {
      score += 60;
      matchedTerms.push(`name_sub:${token}`);
    }
    if (keywords.some((k) => k.includes(token) || (stripped.length >= 3 && k.includes(stripped)))) {
      score += 50;
    }
    if (colloquial.some((c) => c.includes(token) || (stripped.length >= 3 && c.includes(stripped)))) {
      score += 40;
    }

    // مطابقة تقريبية (Fuzzy) — للكلمات الطويلة بس
    if (token.length >= 4) {
      const bestNameSim = Math.max(...nameAr.split(' ').map((w) => similarity(w, token)), 0);
      if (bestNameSim > 0.8) {
        score += 80;
        matchedTerms.push(`name_fuzzy:${token}`);
      }
      const bestKwSim = Math.max(...keywords.map((k) => similarity(k, token)), 0);
      if (bestKwSim > 0.85) {
        score += 60;
        matchedTerms.push(`keyword_fuzzy:${token}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 4) مطابقة المنطقة / مجموعة العضلات
  // -------------------------------------------------------------------------
  const regionKeywords = [
    'back', 'lower-back', 'neck', 'shoulder', 'knee', 'leg', 'arm',
    'head', 'chest', 'torso', 'hip', 'hand', 'foot',
  ];
  for (const token of queryTokens) {
    if (regionKeywords.includes(token)) {
      if (condition.regions.includes(token)) {
        score += 70;
        matchedTerms.push(`region:${token}`);
      }
      if (condition.muscleGroups.includes(token)) {
        score += 50;
        matchedTerms.push(`muscle:${token}`);
      }
    }
  }

  // -------------------------------------------------------------------------
  // 5) تخفيض الحالات المنتشرة (diffuse) عند وجود شكوى موضعية
  // -------------------------------------------------------------------------
  if (condition.diffuse && queryTokens.length >= 1) {
    const hasLocalRegion = queryTokens.some(
      (t) => regionKeywords.includes(t) && condition.regions.includes(t),
    );
    if (!hasLocalRegion) {
      score *= 0.6;
    }
  }

  // -------------------------------------------------------------------------
  // 6) 🆕 مكافأة إضافية للـ colloquial المطابق (لو الجملة كلها موجودة)
  // -------------------------------------------------------------------------
  if (colloquial.some((c) => c === normalizedQuery)) {
    score += 500;
    matchedTerms.push('colloquial_bonus');
  }

  // -------------------------------------------------------------------------
  // 7) 🆕 عقوبة للحالات العامة (M79.1, فيبروميالجيا) عند وجود شكوى موضعية
  // -------------------------------------------------------------------------
  if (GENERIC_CONDITION_IDS.has(condition.id)) {
    const hasLocalRegion = queryTokens.some((t) => regionKeywords.includes(t));
    if (hasLocalRegion) {
      score *= 0.4; // خصم 60%
      matchedTerms.push('generic_penalty');
    }
  }

  return {
    condition,
    score: Math.round(score),
    matchedTerms: [...new Set(matchedTerms)],
  };
}

/**
 * البحث الذكي في المكتبة.
 * @example
 * smartSearch('ضهري بيوجعني', getAllConditions())
 * // → [{ condition: Low Back Pain, score: 950, matchedTerms: [...] }]
 */
export function smartSearch(
  query: string,
  conditions: MedicalCondition[] = CONDITIONS,
  maxResults = 20,
): SearchResult[] {
  const normalizedQuery = normalizeArabic(query);
  if (!normalizedQuery || normalizedQuery.length < 2) return [];

  const queryTokens = tokenize(normalizedQuery);
  const results: SearchResult[] = [];

  for (const condition of conditions) {
    const result = scoreCondition(condition, normalizedQuery, queryTokens);
    if (result.score > 0) results.push(result);
  }

  return results.sort((a, b) => b.score - a.score).slice(0, maxResults);
}

// ============================================================================
// الواجهة العامة (نفس الأسماء القديمة — بدون كسر أي حاجة)
// ============================================================================

/** ترجمة نص ثلاثي اللغة مع الرجوع للعربية. */
export function localize(value: LocalizedText, language: Language): string {
  return value[language] ?? value.ar;
}

/** الحالات المرضية المرتبطة بمنطقة فرعية تشريحية. */
export function getConditionsBySubRegion(subRegionId: string): MedicalCondition[] {
  return CONDITIONS.filter((c) => c.taxonomy?.subRegion === subRegionId);
}

/** الحالات المرضية المرتبطة ببنية تشريحية محددة. */
export function getConditionsByStructure(structureId: string): MedicalCondition[] {
  return CONDITIONS.filter((c) => c.taxonomy?.structures?.includes(structureId));
}

/** الحالات الإقليمية. */
export function getRegionalConditions(): MedicalCondition[] {
  return REGIONAL_CONDITIONS;
}

/** الحالات المُضافة في دفعة إقليمية محددة. */
export function getConditionsByBatch(batch: string): MedicalCondition[] {
  return CONDITIONS.filter((c) => c.batch === batch);
}

/** كل الأمراض. */
export function getAllConditions(): MedicalCondition[] {
  return CONDITIONS;
}

/** كل الأعراض. */
export function getAllSymptoms(): MedicalSymptom[] {
  return SYMPTOMS;
}

/** جلب حالة بالمعرّف. */
export function getConditionById(id: string): MedicalCondition | null {
  return CONDITIONS.find((c) => c.id === id) ?? null;
}

/** جلب عرض بالمعرّف. */
export function getSymptomById(id: string): MedicalSymptom | null {
  return SYMPTOMS.find((s) => s.id === id) ?? null;
}

/** الأمراض المرتبطة بمجموعة عضلات. */
export function getConditionsByMuscleGroup(group: string): MedicalCondition[] {
  return CONDITIONS.filter((c) => c.muscleGroups.includes(group));
}

/** الأمراض المرتبطة بمنطقة جسم. */
export function getConditionsByRegion(region: string): MedicalCondition[] {
  return CONDITIONS.filter((c) => c.regions.includes(region));
}

/** الأعراض المرتبطة بمنطقة جسم. */
export function getSymptomsByRegion(region: string): MedicalSymptom[] {
  return SYMPTOMS.filter((s) => s.regions.includes(region));
}

/** الأعراض المرتبطة بحالة (HPO). */
export function getSymptomsForCondition(condition: MedicalCondition): MedicalSymptom[] {
  return condition.symptoms
    .map((code) => SYMPTOMS.find((s) => s.id === code))
    .filter((x): x is MedicalSymptom => Boolean(x));
}

/** هل الحالة فيها red flags؟ */
export function hasRedFlags(condition: MedicalCondition): boolean {
  const rf = condition.redFlags;
  return Boolean(rf && (rf.ar || rf.en || rf.fr));
}

/**
 * البحث الطبي (الواجهة القديمة — بقت بتستخدم smartSearch جوّه).
 * بترجع نفس الشكل القديم عشان ما تكسرش أي كود بيستخدمها.
 */
export function searchMedicalLibrary(query: string): {
  conditions: MedicalCondition[];
  symptoms: MedicalSymptom[];
  results: SearchResult[];
} {
  if (!query || query.trim().length < 2) {
    return { conditions: [], symptoms: [], results: [] };
  }

  const results = smartSearch(query, CONDITIONS, 20);
  const conditions = results.map((r) => r.condition);

  const normalizedQ = query.trim().toLowerCase();
  const symptoms = SYMPTOMS.filter((s) => {
    const ar = s.name.ar.toLowerCase();
    const en = s.name.en.toLowerCase();
    const fr = s.name.fr.toLowerCase();
    return ar.includes(normalizedQ) || en.includes(normalizedQ) || fr.includes(normalizedQ);
  });

  return { conditions, symptoms, results };
}

/** اقتراحات سريعة للواجهة. */
export function getSearchSuggestions(): string[] {
  return [
    'وجع في ضهري',
    'صداع',
    'وجع في رقبتي',
    'وجع في كتفي',
    'وجع في ركبتي',
    'تنميل في رجلي',
    'حاسس بشد عضلي',
    'جسمي كله بيوجعني',
  ];
}

/** إحصائيات المكتبة. */
export function getLibraryStats() {
  const groups = new Set<string>();
  const regions = new Set<string>();
  CONDITIONS.forEach((c) => {
    c.muscleGroups.forEach((g) => groups.add(g));
    c.regions.forEach((r) => regions.add(r));
  });
  const batches = new Set<string>();
  CONDITIONS.forEach((c) => {
    if (c.batch) batches.add(c.batch);
  });
  return {
    conditions: CONDITIONS.length,
    regionalConditions: REGIONAL_CONDITIONS.length,
    batches: batches.size,
    symptoms: SYMPTOMS.length,
    muscleGroups: groups.size,
    regions: regions.size,
  };
}

// ============================================================================
// 🆕 دوال مساعدة إضافية (زيادة — بدون كسر أي حاجة قديمة)
// ============================================================================

/**
 * الحالات اللي عندها كلمات مفتاحية مسجّلة في KEYWORDS_MAP.
 * مفيدة للمراجعة والتأكد من تغطية المكتبة.
 */
export function getConditionsWithKeywords(): MedicalCondition[] {
  return CONDITIONS.filter((c) => KEYWORDS_MAP[c.id] !== undefined);
}

/**
 * الحالات اللي عندها كلمات مفتاحية مسجّلة لكن الـ id بتاعها مش موجود
 * في المكتبة (يعني مفتاح ميت). مفيدة للتنظيف.
 */
export function getOrphanKeywordIds(): string[] {
  const libraryIds = new Set(CONDITIONS.map((c) => c.id));
  return Object.keys(KEYWORDS_MAP).filter((id) => !libraryIds.has(id));
}

/**
 * إحصائيات قاموس الكلمات المفتاحية.
 */
export function getKeywordStats() {
  const total = Object.keys(KEYWORDS_MAP).length;
  const withColloquial = Object.values(KEYWORDS_MAP).filter(
    (e) => e.colloquial.length > 0,
  ).length;
  const totalKeywords = Object.values(KEYWORDS_MAP).reduce(
    (sum, e) => sum + e.keywords.length,
    0,
  );
  const totalColloquial = Object.values(KEYWORDS_MAP).reduce(
    (sum, e) => sum + e.colloquial.length,
    0,
  );
  return {
    mappedConditions: total,
    withColloquial,
    totalKeywords,
    totalColloquial,
  };
}

/**
 * البحث التشخيصي (Debug) — بترجع تفاصيل المطابقة لكل حالة.
 * مفيدة أثناء التطوير لمعرفة ليه حالة معينة طلعت أو لأ.
 */
export function debugSearch(query: string, maxResults = 10): Array<{
  id: string;
  name: string;
  score: number;
  matchedTerms: string[];
}> {
  const results = smartSearch(query, CONDITIONS, maxResults);
  return results.map((r) => ({
    id: r.condition.id,
    name: r.condition.name.ar,
    score: r.score,
    matchedTerms: r.matchedTerms,
  }));
}

/**
 * الحالات العامة (Generic) — اللي الـ score بتاعها بيتخفّض دايمًا.
 */
export function getGenericConditionIds(): string[] {
  return [...GENERIC_CONDITION_IDS];
}

// ============================================================================
// Stubs للتوافق مع hooks القديمة (لو مش موجودة عندك امسحهم)
// ============================================================================

export function getTaxonomy() {
  return { regions: [], subRegions: [], structures: [] };
}
export function getSubRegions(_regionId: string) {
  return [];
}
export function getStructure(_structureId: string) {
  return null;
}
export function getTaxonomyStats() {
  return { regions: 0, subRegions: 0, structures: 0 };
}
export function getTaxonomyNotice(_lang: Language) {
  return '';
    }
