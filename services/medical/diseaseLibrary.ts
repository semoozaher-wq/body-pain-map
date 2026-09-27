// ============================================================================
// services/medical/diseaseLibrary.ts
// ----------------------------------------------------------------------------
// مكتبة الأمراض والأعراض المحلية (offline) — DOID + HPO + ICD-10 + MedlinePlus
// ----------------------------------------------------------------------------
// النسخة دي فيها محرك بحث ذكي مبني من الصفر:
//   - تطبيع النص العربي (ضهري = ظهري، ألم = وجع، إلخ)
//   - إزالة السوابق واللواحق (بضهري → ضهر)
//   - بحث تقريبي (Fuzzy) للأخطاء الإملائية
//   - قاموس كلمات مفتاحية وعامية مصرية لكل حالة (40 حالة)
//   - خوارزمية ترتيب (Scoring) — النتائج الأهم أولاً
//   - (v4) إضافة كلمات مفتاحية لحالات organConditions.json الـ 15
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

/** حالات منتشرة (Diffuse) — بتخفّض درجتها عند وجود شكوى موضعية. */
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
// مفتاح كل حالة = الـ id الحقيقي بتاعها في diseases.json أو organConditions.json
// ============================================================================

interface KeywordEntry {
  keywords: string[];
  colloquial: string[];
}

const KEYWORDS_MAP: Record<string, KeywordEntry> = {
  // ==========================================================================
  // أولاً: أمراض العظام والعضلات (من diseases.json) — 25 حالة
  // ==========================================================================

  // ===== ألم أسفل الظهر الميكانيكي (M54.5) =====
  'doid:4536': {
    keywords: [
      'ألم', 'وجع', 'شد', 'تعب', 'ضغط', 'حرقة', 'تقلص',
      'ظهر', 'ضهر', 'أسفل الظهر', 'أسفل ضهري', 'وسط ضهري', 'وسط ظهري',
      'فقرات', 'عمود فقري', 'حوض', 'قطنية', 'أسفل الحوض',
      'back pain', 'low back', 'lumbar', 'lumbago', 'backache',
    ],
    colloquial: [
      'ضهري بيوجعني', 'وجع في ضهري', 'حاسس بوجع في أسفل ضهري',
      'ضهري تعبان', 'مش قادر أقف من وجع ضهري', 'وجع في وسط ضهري',
      'حاسس بشد في ضهري',
    ],
  },

  // ===== ألم الرقبة (M54.2) =====
  'doid:1167': {
    keywords: [
      'رقبة', 'رقبتي', 'الرقبة', 'وجع رقبة', 'شد رقبة', 'تقلص رقبة',
      'فقرات الرقبة', 'الفقرات العنقية', 'عنقي', 'عنق', 'تصلب الرقبة',
      'neck pain', 'cervicalgia', 'cervical', 'neck ache', 'stiff neck',
    ],
    colloquial: [
      'رقبتي بتوجعني', 'وجع في رقبتي', 'رقبتي مش قادر ألفها',
      'حاسس بشد في رقبتي', 'وجع في الرقبة من النوم',
    ],
  },

  // ===== إصابة الكفة المدورة (M75.1) =====
  'doid:3059': {
    keywords: [
      'كتف', 'كتفي', 'الكتف', 'وجع كتف', 'شد كتف', 'تقلص كتف',
      'الكفة المدورة', 'الكتف الأيسر', 'الكتف الأيمن', 'كتف متجمد',
      'rotator cuff', 'shoulder pain', 'frozen shoulder', 'shoulder',
    ],
    colloquial: [
      'كتفي بتوجعني', 'وجع في كتفي', 'مش قادر أرفع إيدي',
      'كتفي مش قادر أحركه', 'حاسس بشد في كتفي',
    ],
  },

  // ===== خشونة الركبة (M17) =====
  'doid:8398': {
    keywords: [
      'ركبة', 'ركبتي', 'الركبة', 'وجع ركبة', 'شد ركبة',
      'خشونة الركبة', 'الغضروف', 'غضروف الركبة', 'المفصل', 'مفصل الركبة',
      'knee pain', 'knee osteoarthritis', 'knee', 'gonarthrosis',
    ],
    colloquial: [
      'ركبتي بتوجعني', 'وجع في ركبتي', 'ركبتي بتعمل صوت',
      'مش قادر أثني ركبتي', 'ركبتي وارمة',
    ],
  },

  // ===== فيبروميالجيا (M79.67) =====
  'doid:1490': {
    keywords: [
      'فيبروميالجيا', 'ألم عضلي', 'ألم منتشر', 'تعب مزمن', 'إرهاق',
      'ألم في كل الجسم', 'وجع في كل حتة', 'إجهاد مزمن', 'ألم ليلي',
      'fibromyalgia', 'chronic pain', 'widespread pain', 'fatigue',
    ],
    colloquial: [
      'جسمي كله بيوجعني', 'وجع في كل حتة', 'تعبان طول الوقت',
      'حاسس بإرهاق مستمر', 'جسمي مكسر',
    ],
  },

  // ===== الصداع النصفي (G43) =====
  'doid:3311': {
    keywords: [
      'صداع', 'صداع نصفي', 'الشقيقة', 'وجع راس', 'وجع في راسي',
      'ألم في الرأس', 'صداع شديد', 'غثيان', 'دوخة', 'حساسية للضوء',
      'migraine', 'headache', 'head pain', 'cephalgia',
    ],
    colloquial: [
      'راسي بتوجعني', 'عندي صداع', 'صداع نصفي',
      'حاسس بوجع في نص راسي', 'الصداع مش بيروح',
    ],
  },

  // ===== الصداع التوتري (G44.2) =====
  'doid:11476-th': {
    keywords: [
      'صداع توتري', 'صداع', 'شد في الرقبة', 'ضغط في الرأس',
      'صداع من التوتر', 'صداع من الشغل', 'صداع خفيف مستمر',
      'tension headache', 'stress headache', 'headache',
    ],
    colloquial: [
      'صداع من الشغل', 'حاسس بضغط في دماغي', 'راسي تقيلة',
      'صداع من التوتر', 'حاسس بشد في راسي',
    ],
  },

  // ===== ألم العضلات (M79.1) =====
  'doid:8505': {
    keywords: [
      'ألم عضلي', 'ألم في العضلات', 'ميالجيا', 'وجع عضلي', 'ألم عام',
      'ألم في كل العضلات', 'تعب عضلي',
      'myalgia', 'muscle pain', 'muscular pain',
    ],
    colloquial: [
      'عضلاتي بتوجعني', 'جسمي كله بوجع', 'حاسس بألم في عضلاتي',
    ],
  },

  // ===== ألم عضلي بعد المجهود DOMS (M79.1) =====
  'doid:8505-doms': {
    keywords: [
      'ألم بعد التمرين', 'ألم بعد المجهود', 'تعب بعد الرياضة',
      'وجع بعد الجيم', 'ألم عضلي متأخر', 'DOMS',
      'delayed onset muscle soreness', 'muscle soreness',
    ],
    colloquial: [
      'جسمي بيوجعني بعد الجيم', 'عضلاتي بتوجعني بعد التمرين',
      'حاسس بألم بعد ما لعبت رياضة',
    ],
  },

  // ===== شد عضلي (M62.838) =====
  'doid:6713': {
    keywords: [
      'شد عضلي', 'تقلص', 'تشنج', 'تقلص عضلي', 'وجع عضلي',
      'شد في العضلة', 'تعب العضلة', 'تشنج عضلي', 'تقلصات',
      'muscle spasm', 'muscle cramps', 'spasm', 'cramp', 'muscle strain',
    ],
    colloquial: [
      'حاسس بتقلص في رجلي', 'عضلاتي بتشد', 'حاسس بشد في ضهري',
      'رجلي بتتقلص', 'عضلاتي بتوجعني',
    ],
  },

  // ===== الانزلاق الغضروفي العنقي (M50.1) =====
  'doid:10202': {
    keywords: [
      'انزلاق غضروفي عنقي', 'ديسك الرقبة', 'انزلاق فقرات الرقبة',
      'الانزلاق العنقي', 'غضروف الرقبة', 'ضغط على عصب الرقبة',
      'cervical disc herniation', 'cervical disc', 'herniated cervical disc',
    ],
    colloquial: [
      'رقبتي بتوجعني وبتنمّل إيدي', 'ديسك في رقبتي',
      'وجع في رقبتي بينزل على إيدي', 'إيدي بتتنمّل من رقبتي',
    ],
  },

  // ===== الانزلاق الغضروفي القطني (M51.16) =====
  'doid:10202-ls': {
    keywords: [
      'انزلاق غضروفي قطني', 'ديسك أسفل الظهر', 'ديسك الظهر',
      'عرق النسا', 'ألم الساق', 'ألم ينزل', 'شد في الساق',
      'تنميل', 'ضغط على العصب', 'ألم عصبي', 'جذور الأعصاب',
      'sciatica', 'lumbar disc herniation', 'radiculopathy', 'nerve pain',
    ],
    colloquial: [
      'وجع في ضهري بينزل على رجلي', 'حاسس بتنميل في رجلي',
      'وجع في ضهري وبيوصل لساقي', 'رجلي بتتنمّل',
      'حاسس بوجع في ساقي من ضهري', 'ديسك في ضهري',
    ],
  },

  // ===== الروماتويد (M05) =====
  'doid:8483': {
    keywords: [
      'روماتويد', 'التهاب المفاصل الروماتويدي', 'الروماتيزم',
      'التهاب المفاصل المزمن', 'مرض مناعي', 'تورم المفاصل',
      'تيبس صباحي', 'rheumatoid arthritis', 'RA',
    ],
    colloquial: [
      'مفاصلي وارمة من الصبح', 'مفاصلي بتوجعني وتيبست',
      'إيديا وارمة', 'عندي روماتويد',
    ],
  },

  // ===== النفق الرسغي (G56.0) =====
  'doid:13241': {
    keywords: [
      'النفق الرسغي', 'متلازمة النفق الرسغي', 'التنميل في الإيد',
      'تنميل الأصابع', 'وجع في الرسغ', 'ضعف الإيد', 'إبهام',
      'carpal tunnel', 'carpal tunnel syndrome', 'wrist pain',
    ],
    colloquial: [
      'إيدي بتتنمّل', 'رسغي بوجعني', 'صوابعي بتتنمّل',
      'إيدي بتضعف من كتر الكتابة',
    ],
  },

  // ===== اللفافة الأخمصية (M72.2) =====
  'doid:4248': {
    keywords: [
      'اللفافة الأخمصية', 'وجع الكعب', 'ألم الكعب', 'ألم أسفل القدم',
      'plantar fasciitis', 'heel pain', 'foot pain',
    ],
    colloquial: [
      'كعبي بيوجعني من الصبح', 'أول ما أقف كعبي بيوجعني',
      'قدمي بتوجعني تحت',
    ],
  },

  // ===== التهاب الأوتار (M79.7) =====
  'doid:11067': {
    keywords: [
      'التهاب الأوتار', 'التهاب الوتر', 'وجع في الوتر',
      'التهاب وتر أخيل', 'التهاب أوتار الكتف', 'تندينيت',
      'tendinitis', 'tendonitis', 'tendon pain',
    ],
    colloquial: [
      'وتري بوجعني', 'حاسس بألم في الوتر', 'وجع في وتر رجلي',
    ],
  },

  // ===== ألم المفاصل - أرثالجا (M25.50) =====
  'doid:0050896': {
    keywords: [
      'ألم المفاصل', 'أرثالجا', 'وجع المفاصل',
      'joint pain', 'arthralgia',
    ],
    colloquial: [
      'مفاصلي بتوجعني', 'وجع في مفاصلي',
    ],
  },

  // ===== اعتلال الأعصاب المحيطية (G62.9) =====
  'doid:9350': {
    keywords: [
      'اعتلال الأعصاب', 'تنميل الأطراف', 'حرقان في القدم',
      'التنميل المزمن', 'ألم عصبي مزمن', 'neuropathy',
      'peripheral neuropathy', 'tingling',
    ],
    colloquial: [
      'رجليّ بتتنمّل', 'إيديا ورجليا بتتنمّل',
      'حاسس بحرقان في رجلي',
    ],
  },

  // ===== التواء الكاحل (S93.4) =====
  'doid:10629': {
    keywords: [
      'التواء الكاحل', 'لوي الكاحل', 'إصابة الكاحل', 'كاحل',
      'ankle sprain', 'sprained ankle', 'ankle injury',
    ],
    colloquial: [
      'كوستي', 'كاحلي اتلوى', 'كوستي بوجعني',
    ],
  },

  // ===== ألم اليد والرسغ (M79.64) =====
  'doid:7148': {
    keywords: [
      'ألم اليد', 'ألم الرسغ', 'إجهاد متكرر', 'وجع الرسغ',
      'hand pain', 'wrist pain', 'repetitive strain',
    ],
    colloquial: [
      'إيدي بتوجعني', 'رسغي بوجعني', 'إيدي تعبت من الكتابة',
    ],
  },

  // ===== الفصال العظمي (M19.9) =====
  'doid:8398-oa': {
    keywords: [
      'خشونة المفاصل', 'الفصال العظمي', 'تآكل الغضروف', 'خشونة',
      'المفاصل', 'وجع مفاصل', 'تآكل المفاصل',
      'osteoarthritis', 'OA', 'degenerative joint disease',
    ],
    colloquial: [
      'مفاصلي بتوجعني', 'مفاصلي بتطلع صوت',
      'حاسس بخشونة في مفاصلي',
    ],
  },

  // ===== ارتفاع ضغط الدم (I10) =====
  'doid:10763': {
    keywords: [
      'ضغط الدم', 'ارتفاع ضغط الدم', 'الضغط', 'ضغط عالي',
      'hypertension', 'high blood pressure',
    ],
    colloquial: [
      'عندي ضغط', 'الضغط عالي', 'حاسس بضغط في دماغي',
      'عندي صداع من الضغط',
    ],
  },

  // ===== الارتجاع المريئي (K21.9) =====
  'doid:12353': {
    keywords: [
      'الارتجاع المريئي', 'الحموضة', 'حرقة المعدة', 'ارتجاع',
      'gastroesophageal reflux', 'GERD', 'heartburn', 'acid reflux',
    ],
    colloquial: [
      'حاسس بحموضة', 'حرقة في صدري', 'الأكل بيرجع لي',
      'حاسس بحرقة في معدتي',
    ],
  },

  // ==========================================================================
  // ثانياً: أمراض الأعضاء الداخلية (من organConditions.json) — 15 حالة
  // ==========================================================================

  // ===== التهاب الزائدة الدودية (K35) =====
  'doid:appendicitis': {
    keywords: [
      'التهاب الزائدة', 'الزائدة الدودية', 'زائدة', 'appendicitis',
      'ألم أسفل يمين البطن', 'ألم حول السرة',
    ],
    colloquial: [
      'وجع في أسفل يمين بطني', 'بطني بتوجعني من ناحية اليمين',
      'وجع حول السرة', 'حاسس بوجع في بطني وجاي على اليمين',
    ],
  },

  // ===== التهاب المعدة (K29) =====
  'doid:gastritis': {
    keywords: [
      'التهاب المعدة', 'عسر الهضم', 'حرقة المعدة', 'gastritis', 'dyspepsia',
      'ألم أعلى البطن', 'حموضة', 'انتفاخ',
    ],
    colloquial: [
      'معدتي بتوجعني', 'حاسس بحرقة في معدتي',
      'بطني من فوق بتوجعني', 'حاسس بانتفاخ بعد الأكل',
      'معدتي تعبانة',
    ],
  },

  // ===== قرحة المعدة/الاثني عشر (K27) =====
  'doid:peptic-ulcer': {
    keywords: [
      'قرحة المعدة', 'قرحة الاثني عشر', 'peptic ulcer',
      'حرقة شديدة', 'ألم أعلى البطن',
    ],
    colloquial: [
      'عندي قرحة', 'حرقة في معدتي بتروح وتيجي',
      'وجع في معدتي بعد الأكل', 'حرقة في بطني من فوق',
    ],
  },

  // ===== القولون العصبي (K58) =====
  'doid:ibs': {
    keywords: [
      'القولون العصبي', 'القولون', 'IBS', 'irritable bowel syndrome',
      'انتفاخ', 'مغص', 'إسهال', 'إمساك', 'غازات',
    ],
    colloquial: [
      'عندي قولون', 'القولون بيوجعني', 'بطني بتنفخ',
      'عندي غازات', 'بطني بتعمل أصوات', 'معدتي وامعائي بتوجعني',
    ],
  },

  // ===== التهاب الرتوج (K57) =====
  'doid:diverticulitis': {
    keywords: [
      'التهاب الرتوج', 'التهاب القولون', 'diverticulitis',
      'ألم أسفل يسار البطن', 'حرارة مع ألم البطن',
    ],
    colloquial: [
      'وجع في أسفل يسار بطني', 'بطني بتوجعني من ناحية الشمال',
      'حاسس بوجع في بطني مع حرارة',
    ],
  },

  // ===== النزلة المعوية (A09) =====
  'doid:gastroenteritis': {
    keywords: [
      'النزلة المعوية', 'نزلة معوية', 'gastroenteritis',
      'إسهال', 'قيء', 'مغص', 'تسمم غذائي',
    ],
    colloquial: [
      'عندي نزلة معوية', 'عندي إسهال وقيء',
      'بطني بتوجعني وعندي إسهال', 'حاسس بمغص في بطني',
    ],
  },

  // ===== حصى المرارة (K80) =====
  'doid:gallstones': {
    keywords: [
      'حصى المرارة', 'التهاب المرارة', 'gallstones', 'cholecystitis',
      'ألم أعلى يمين البطن', 'ألم بعد الأكل الدسم',
    ],
    colloquial: [
      'عندي حصى في المرارة', 'وجع في يمين بطني من فوق',
      'بطني بتوجعني بعد الأكل الدسم', 'وجع في المرارة',
    ],
  },

  // ===== التهاب الكبد (K75.9) =====
  'doid:hepatitis': {
    keywords: [
      'التهاب الكبد', 'hepatitis', 'ألم الكبد', 'اصفرار',
      'يرقان', 'jaundice',
    ],
    colloquial: [
      'عندي التهاب في الكبد', 'كبدي بتوجعني',
      'عيوني بقت صفراء', 'حاسس بإجهاد شديد ووجع في جنبي',
    ],
  },

  // ===== التهاب البنكرياس (K85) =====
  'doid:pancreatitis': {
    keywords: [
      'التهاب البنكرياس', 'pancreatitis',
      'ألم أعلى البطن ينتقل للظهر',
    ],
    colloquial: [
      'عندي التهاب في البنكرياس', 'بطني بتوجعني وينزل على ضهري',
      'وجع في بطني من فوق وبينزل على ضهري',
    ],
  },

  // ===== التهاب المسالك البولية (N39.0) =====
  'doid:uti': {
    keywords: [
      'التهاب المسالك', 'التهاب المسالك البولية', 'UTI',
      'حرقان في البول', 'كثرة التبول', 'urinary tract infection',
    ],
    colloquial: [
      'عندي حرقان في البول', 'بتبول كتير', 'بطني من تحت بتوجعني',
      'حاسس بحرقان وأنا بتبول',
    ],
  },

  // ===== حصى الكلى (N20.0) =====
  'doid:kidney-stone': {
    keywords: [
      'حصى الكلى', 'حصى الكلى', 'kidney stones',
      'ألم في الخاصرة', 'ألم الكلى', 'دم في البول',
    ],
    colloquial: [
      'عندي حصى في الكلى', 'جنبي بتوجعني بشكل شديد',
      'وجع في خاصرتي', 'حاسس بوجع في كليتي',
    ],
  },

  // ===== كيس على المبيض (N83.2) =====
  'doid:ovarian-cyst': {
    keywords: [
      'كيس على المبيض', 'كيس المبيض', 'ovarian cyst',
      'ألم أسفل البطن', 'ألم الحوض',
    ],
    colloquial: [
      'عندي كيس على المبيض', 'بطني من تحت بتوجعني من ناحية واحدة',
      'حاسس بوجع في الحوض',
    ],
  },

  // ===== بطانة الرحم المهاجرة (N80) =====
  'doid:endometriosis': {
    keywords: [
      'بطانة الرحم المهاجرة', 'endometriosis', 'ألم الحوض',
      'ألم الدورة الشهرية',
    ],
    colloquial: [
      'عندي بطانة الرحم المهاجرة', 'بوجع بشدة وقت الدورة',
      'وجع في الحوض وقت الدورة', 'الدورة بتوجعني بشدة',
    ],
  },

  // ===== الذبحة الصدرية (I20.9) =====
  'doid:angina': {
    keywords: [
      'الذبحة الصدرية', 'ذبحة صدرية', 'angina',
      'ألم الصدر', 'ضغط في الصدر', 'chest pain',
    ],
    colloquial: [
      'عندي ذبحة', 'صدري بيوجعني',
      'حاسس بضغط في صدري', 'ألم في الصدر مع مجهود',
    ],
  },

  // ===== الارتجاع المعدي المريئي (organ) (K21.9) =====
  'doid:gerd-organ': {
    keywords: [
      'الارتجاع المعدي المريئي', 'حموضة المريء', 'GERD',
      'ارتجاع', 'حموضة',
    ],
    colloquial: [
      'حاسس بحموضة في صدري', 'الأكل بيرجع لي',
      'حاسس بحرقة في صدري بعد الأكل',
    ],
  },
};

// ============================================================================
// حالات عامة (Generic) — الـ score بتاعها يُخفَّض دايمًا
// ============================================================================
const GENERIC_CONDITION_IDS = new Set<string>([
  'doid:8505',       // الميالجيا M79.1
  'doid:8505-doms',  // DOMS M79.1
  'doid:1490',       // فيبروميالجيا M79.67
  'doid:0050896',    // ألم المفاصل (عام) M25.50
  'doid:9350',       // اعتلال الأعصاب (عام) G62.9
]);

// ============================================================================
// أدوات معالجة النص العربي
// ============================================================================

function normalizeArabic(text: string): string {
  if (!text) return '';
  let n = text;
  n = n.replace(/[\u064B-\u065F\u0670]/g, '');
  n = n.replace(/\u0640/g, '');
  n = n.replace(/[أإآٱ]/g, 'ا');
  n = n.replace(/ؤ/g, 'و').replace(/ئ/g, 'ي');
  n = n.replace(/ة/g, 'ه');
  n = n.replace(/ى/g, 'ي');
  n = n.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  n = n.replace(/[.,!?؟،؛:؛"'`~@#$%^&*()_+=\[\]{}|\\/<>]/g, ' ');
  n = n.replace(/\s+/g, ' ').trim();
  n = n.toLowerCase();
  return n;
}

function tokenize(text: string): string[] {
  const n = normalizeArabic(text);
  if (!n) return [];
  return n.split(' ').filter((w) => w.length > 1);
}

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

function scoreCondition(
  condition: MedicalCondition,
  normalizedQuery: string,
  queryTokens: string[],
): SearchResult {
  let score = 0;
  const matchedTerms: string[] = [];

  const nameAr = normalizeArabic(condition.name.ar);
  const nameEn = condition.name.en.toLowerCase();
  const nameFr = condition.name.fr.toLowerCase();
  const summaryAr = normalizeArabic(condition.summary.ar);

  const kwEntry = KEYWORDS_MAP[condition.id];
  const keywords = kwEntry ? kwEntry.keywords.map(normalizeArabic) : [];
  const colloquial = kwEntry ? kwEntry.colloquial.map(normalizeArabic) : [];

  // 1) مطابقة الجملة الكاملة
  if (normalizedQuery === nameAr) { score += 1000; matchedTerms.push('name_exact'); }
  if (colloquial.some((c) => c === normalizedQuery)) { score += 900; matchedTerms.push('colloquial_exact'); }
  if (keywords.some((k) => k === normalizedQuery)) { score += 800; matchedTerms.push('keyword_exact'); }

  // 2) مطابقة الجملة كجزء من النص
  if (nameAr.includes(normalizedQuery)) { score += 500; matchedTerms.push('name_includes'); }
  if (colloquial.some((c) => c.includes(normalizedQuery))) { score += 450; matchedTerms.push('colloquial_includes'); }
  if (keywords.some((k) => k.includes(normalizedQuery))) { score += 400; matchedTerms.push('keyword_includes'); }
  if (nameEn.includes(normalizedQuery) || nameFr.includes(normalizedQuery)) { score += 350; matchedTerms.push('name_en_fr'); }
  if (summaryAr.includes(normalizedQuery)) { score += 100; matchedTerms.push('summary'); }

  // 3) مطابقة الكلمات المنفصلة
  for (const token of queryTokens) {
    const stripped = stripAffixes(token);
    if (nameAr.split(' ').some((w) => w === token || w === stripped)) { score += 150; matchedTerms.push(`name_token:${token}`); }
    if (keywords.some((k) => k.split(' ').includes(token) || k.split(' ').includes(stripped))) { score += 120; matchedTerms.push(`keyword_token:${token}`); }
    if (colloquial.some((c) => c.split(' ').includes(token) || c.split(' ').includes(stripped))) { score += 100; matchedTerms.push(`colloquial_token:${token}`); }
    if (nameAr.includes(token) || (stripped.length >= 3 && nameAr.includes(stripped))) { score += 60; matchedTerms.push(`name_sub:${token}`); }
    if (keywords.some((k) => k.includes(token) || (stripped.length >= 3 && k.includes(stripped)))) { score += 50; }
    if (colloquial.some((c) => c.includes(token) || (stripped.length >= 3 && c.includes(stripped)))) { score += 40; }
    if (token.length >= 4) {
      const bestNameSim = Math.max(...nameAr.split(' ').map((w) => similarity(w, token)), 0);
      if (bestNameSim > 0.8) { score += 80; matchedTerms.push(`name_fuzzy:${token}`); }
      const bestKwSim = Math.max(...keywords.map((k) => similarity(k, token)), 0);
      if (bestKwSim > 0.85) { score += 60; matchedTerms.push(`keyword_fuzzy:${token}`); }
    }
  }

  // 4) مطابقة المنطقة / مجموعة العضلات
  const regionKeywords = [
    'back', 'lower-back', 'neck', 'shoulder', 'knee', 'leg', 'arm',
    'head', 'chest', 'torso', 'hip', 'hand', 'foot',
  ];
  for (const token of queryTokens) {
    if (regionKeywords.includes(token)) {
      if (condition.regions.includes(token)) { score += 70; matchedTerms.push(`region:${token}`); }
      if (condition.muscleGroups.includes(token)) { score += 50; matchedTerms.push(`muscle:${token}`); }
    }
  }

  // 5) تخفيض الحالات المنتشرة
  if (condition.diffuse && queryTokens.length >= 1) {
    const hasLocalRegion = queryTokens.some(
      (t) => regionKeywords.includes(t) && condition.regions.includes(t),
    );
    if (!hasLocalRegion) score *= 0.6;
  }

  // 6) مكافأة colloquial المطابق
  if (colloquial.some((c) => c === normalizedQuery)) {
    score += 500;
    matchedTerms.push('colloquial_bonus');
  }

  // 7) عقوبة الحالات العامة عند وجود شكوى موضعية
  if (GENERIC_CONDITION_IDS.has(condition.id)) {
    const hasLocalRegion = queryTokens.some((t) => regionKeywords.includes(t));
    if (hasLocalRegion) {
      score *= 0.4;
      matchedTerms.push('generic_penalty');
    }
  }

  return {
    condition,
    score: Math.round(score),
    matchedTerms: [...new Set(matchedTerms)],
  };
}

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
// الواجهة العامة
// ============================================================================

export function localize(value: LocalizedText, language: Language): string {
  return value[language] ?? value.ar;
}

export function getConditionsBySubRegion(subRegionId: string): MedicalCondition[] {
  return CONDITIONS.filter((c) => c.taxonomy?.subRegion === subRegionId);
}

export function getConditionsByStructure(structureId: string): MedicalCondition[] {
  return CONDITIONS.filter((c) => c.taxonomy?.structures?.includes(structureId));
}

export function getRegionalConditions(): MedicalCondition[] {
  return REGIONAL_CONDITIONS;
}

export function getConditionsByBatch(batch: string): MedicalCondition[] {
  return CONDITIONS.filter((c) => c.batch === batch);
}

export function getAllConditions(): MedicalCondition[] {
  return CONDITIONS;
}

export function getAllSymptoms(): MedicalSymptom[] {
  return SYMPTOMS;
}

export function getConditionById(id: string): MedicalCondition | null {
  return CONDITIONS.find((c) => c.id === id) ?? null;
}

export function getSymptomById(id: string): MedicalSymptom | null {
  return SYMPTOMS.find((s) => s.id === id) ?? null;
}

export function getConditionsByMuscleGroup(group: string): MedicalCondition[] {
  return CONDITIONS.filter((c) => c.muscleGroups.includes(group));
}

export function getConditionsByRegion(region: string): MedicalCondition[] {
  return CONDITIONS.filter((c) => c.regions.includes(region));
}

export function getSymptomsByRegion(region: string): MedicalSymptom[] {
  return SYMPTOMS.filter((s) => s.regions.includes(region));
}

export function getSymptomsForCondition(condition: MedicalCondition): MedicalSymptom[] {
  return condition.symptoms
    .map((code) => SYMPTOMS.find((s) => s.id === code))
    .filter((x): x is MedicalSymptom => Boolean(x));
}

export function hasRedFlags(condition: MedicalCondition): boolean {
  const rf = condition.redFlags;
  return Boolean(rf && (rf.ar || rf.en || rf.fr));
}

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

export function getLibraryStats() {
  const groups = new Set<string>();
  const regions = new Set<string>();
  CONDITIONS.forEach((c) => {
    c.muscleGroups.forEach((g) => groups.add(g));
    c.regions.forEach((r) => regions.add(r));
  });
  const batches = new Set<string>();
  CONDITIONS.forEach((c) => { if (c.batch) batches.add(c.batch); });
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
// دوال مساعدة إضافية
// ============================================================================

export function getConditionsWithKeywords(): MedicalCondition[] {
  return CONDITIONS.filter((c) => KEYWORDS_MAP[c.id] !== undefined);
}

export function getOrphanKeywordIds(): string[] {
  const libraryIds = new Set(CONDITIONS.map((c) => c.id));
  return Object.keys(KEYWORDS_MAP).filter((id) => !libraryIds.has(id));
}

export function getKeywordStats() {
  const total = Object.keys(KEYWORDS_MAP).length;
  const withColloquial = Object.values(KEYWORDS_MAP).filter((e) => e.colloquial.length > 0).length;
  const totalKeywords = Object.values(KEYWORDS_MAP).reduce((sum, e) => sum + e.keywords.length, 0);
  const totalColloquial = Object.values(KEYWORDS_MAP).reduce((sum, e) => sum + e.colloquial.length, 0);
  return { mappedConditions: total, withColloquial, totalKeywords, totalColloquial };
}

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

export function getGenericConditionIds(): string[] {
  return [...GENERIC_CONDITION_IDS];
}

// ============================================================================
// Stubs للتوافق مع hooks القديمة
// ============================================================================

export function getTaxonomy() { return { regions: [], subRegions: [], structures: [] }; }
export function getSubRegions(_regionId: string) { return []; }
export function getStructure(_structureId: string) { return null; }
export function getTaxonomyStats() { return { regions: 0, subRegions: 0, structures: 0 }; }
export function getTaxonomyNotice(_lang: Language) { return ''; }
