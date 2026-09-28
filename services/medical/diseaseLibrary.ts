// ============================================================================
// services/medical/diseaseLibrary.ts
// ----------------------------------------------------------------------------
// مكتبة الأمراض والأعراض المحلية (offline) — DOID + HPO + ICD-10 + MedlinePlus
// ----------------------------------------------------------------------------
// النسخة دي فيها محرك بحث ذكي مبني من الصفر:
//   - تطبيع النص العربي (ضهري = ظهري، ألم = وجع، إلخ)
//   - إزالة السوابق واللواحق (بضهري → ضهر)
//   - بحث تقريبي (Fuzzy) للأخطاء الإملائية
//   - قاموس كلمات مفتاحية وعامية مصرية لكل حالة (60 حالة)
//   - خوارزمية ترتيب (Scoring) — النتائج الأهم أولاً
//   - (v6) دعم "يمين/شمال" للتمييز بين حالات البطن
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

const SUPPLEMENTAL_CONDITIONS: MedicalCondition[] = [
  {
    id: 'local:aortic-aneurysm', doid: null, doidStatus: 'not-mapped', batch: 'AI', icd10: 'I71.9',
    name: { ar: 'تمدد الأوعية الدموية الأورطي', en: 'Aortic aneurysm', fr: 'Anévrisme de l’aorte' },
    summary: { ar: 'تمدد في جدار الشريان الأورطي؛ ألم البطن أو الصدر المفاجئ والشديد يحتاج تقييمًا طارئًا.', en: 'A bulge in the aortic wall; sudden severe chest or abdominal pain needs emergency assessment.', fr: 'Dilatation de la paroi aortique ; une douleur thoracique ou abdominale brutale et intense nécessite une évaluation urgente.' },
    muscleGroups: ['abs', 'chest'], regions: ['torso_front'], symptoms: [],
    redFlags: { ar: 'ألم مفاجئ وشديد في الصدر أو البطن، إغماء أو ضعف شديد.', en: 'Sudden severe chest or abdominal pain, fainting, or marked weakness.', fr: 'Douleur thoracique ou abdominale brutale et intense, malaise ou faiblesse importante.' },
    medlinePlusUrl: '', sources: [],
  },
  {
    id: 'local:edema', doid: null, doidStatus: 'not-mapped', batch: 'AI', icd10: 'R60.0',
    name: { ar: 'وذمة (تورم)', en: 'Edema', fr: 'Œdème' },
    summary: { ar: 'تجمع سوائل يسبب تورمًا، وقد يكون له أسباب متعددة.', en: 'Swelling caused by fluid accumulation with many possible causes.', fr: 'Gonflement lié à une accumulation de liquide, avec plusieurs causes possibles.' },
    muscleGroups: ['legs', 'feet'], regions: ['lower_limb'], symptoms: [],
    redFlags: { ar: 'تورم مفاجئ في ساق واحدة، خصوصًا مع ألم أو ضيق نفس، يحتاج تقييمًا عاجلًا.', en: 'Sudden one-sided leg swelling, especially with pain or shortness of breath, needs urgent assessment.', fr: 'Gonflement brutal d’une jambe, surtout avec douleur ou essoufflement, nécessite une évaluation urgente.' },
    medlinePlusUrl: '', sources: [],
  },
  {
    id: 'local:myocardial-infarction', doid: null, doidStatus: 'not-mapped', batch: 'AI', icd10: 'I21.9',
    name: { ar: 'احتشاء عضلة القلب (جلطة قلبية)', en: 'Myocardial infarction', fr: 'Infarctus du myocarde' },
    summary: { ar: 'حالة طارئة قد تظهر بضغط أو ألم في الصدر مع أعراض أخرى.', en: 'An emergency that can present with chest pressure or pain and other symptoms.', fr: 'Urgence pouvant se manifester par une pression ou douleur thoracique et d’autres symptômes.' },
    muscleGroups: ['chest'], regions: ['torso_front'], symptoms: [],
    redFlags: { ar: 'ضغط أو ألم الصدر مع ضيق نفس أو تعرق أو غثيان أو انتشار للألم يحتاج طوارئ فورًا.', en: 'Chest pressure or pain with breathlessness, sweating, nausea, or spreading pain requires emergency care.', fr: 'Une pression ou douleur thoracique avec essoufflement, sueurs, nausées ou irradiation nécessite les urgences.' },
    medlinePlusUrl: '', sources: [],
  },
  {
    id: 'local:dry-eye-syndrome', doid: null, doidStatus: 'not-mapped', batch: 'AI', icd10: 'H04.12',
    name: { ar: 'متلازمة جفاف العين', en: 'Dry eye syndrome', fr: 'Syndrome de l’œil sec' },
    summary: { ar: 'جفاف أو حرقان أو إحساس بالرمل في العين قد يرتبط بنقص الدموع أو عوامل بيئية.', en: 'Dryness, burning, or gritty eye sensation can occur when tears are insufficient or evaporate too quickly.', fr: 'Sécheresse, brûlure ou sensation de sable lorsque les larmes sont insuffisantes ou s’évaporent trop vite.' },
    muscleGroups: ['eyes'], regions: ['head_neck'], symptoms: [],
    redFlags: { ar: '', en: '', fr: '' }, medlinePlusUrl: '', sources: [],
  },
  {
    id: 'local:sjogren-syndrome', doid: null, doidStatus: 'not-mapped', batch: 'AI', icd10: 'M35.00',
    name: { ar: 'متلازمة شوغرن', en: 'Sjögren syndrome', fr: 'Syndrome de Sjögren' },
    summary: { ar: 'مرض مناعي ذاتي قد يسبب جفاف العين والفم.', en: 'An autoimmune condition that can cause dry eyes and dry mouth.', fr: 'Maladie auto-immune pouvant provoquer une sécheresse des yeux et de la bouche.' },
    muscleGroups: ['eyes'], regions: ['head_neck'], symptoms: [],
    redFlags: { ar: '', en: '', fr: '' }, medlinePlusUrl: '', sources: [],
  },
  {
    id: 'local:glaucoma', doid: null, doidStatus: 'not-mapped', batch: 'AI', icd10: 'H40.9',
    name: { ar: 'الجلوكوما (المياه الزرقاء)', en: 'Glaucoma', fr: 'Glaucome' },
    summary: { ar: 'مجموعة أمراض تصيب العصب البصري؛ ألم العين الشديد أو تغير الرؤية المفاجئ يحتاج تقييمًا عاجلًا.', en: 'A group of optic nerve disorders; severe eye pain or sudden vision change needs urgent assessment.', fr: 'Groupe de maladies du nerf optique ; une douleur oculaire intense ou une modification brutale de la vision nécessite une évaluation urgente.' },
    muscleGroups: ['eyes'], regions: ['head_neck'], symptoms: [],
    redFlags: { ar: 'ألم شديد مفاجئ بالعين مع تشوش أو فقدان رؤية يحتاج طوارئ.', en: 'Sudden severe eye pain with blurred or lost vision requires emergency assessment.', fr: 'Douleur oculaire intense avec vision floue ou perte de vision nécessite une évaluation urgente.' }, medlinePlusUrl: '', sources: [],
  },
  {
    id: 'local:diabetic-neuropathy', doid: null, doidStatus: 'not-mapped', batch: 'AI', icd10: 'E11.42',
    name: { ar: 'اعتلال الأعصاب السكري', en: 'Diabetic neuropathy', fr: 'Neuropathie diabétique' },
    summary: { ar: 'أحد مضاعفات السكري وقد يسبب حرقانًا أو وخزًا أو تنميلًا، خاصة في اليدين والقدمين.', en: 'A complication of diabetes that can cause burning, tingling, or numbness, especially in the hands and feet.', fr: 'Complication du diabète pouvant provoquer brûlures, fourmillements ou engourdissement, surtout aux mains et aux pieds.' },
    muscleGroups: ['hands', 'feet'], regions: ['upper_limb', 'lower_limb'], symptoms: [],
    redFlags: { ar: '', en: '', fr: '' }, medlinePlusUrl: '', sources: [],
  },
  {
    id: 'local:type-2-diabetes', doid: null, doidStatus: 'not-mapped', batch: 'AI', icd10: 'E11.9',
    name: { ar: 'السكري من النوع الثاني', en: 'Type 2 diabetes', fr: 'Diabète de type 2' },
    summary: { ar: 'اضطراب مزمن في سكر الدم؛ جفاف الفم وحده لا يكفي لتشخيصه.', en: 'A chronic blood-glucose disorder; dry mouth alone is not enough to diagnose it.', fr: 'Trouble chronique de la glycémie ; une bouche sèche seule ne suffit pas au diagnostic.' },
    muscleGroups: [], regions: ['torso_front'], symptoms: [],
    redFlags: { ar: '', en: '', fr: '' }, medlinePlusUrl: '', sources: [],
  },
  {
    id: 'local:allergic-rhinitis', doid: null, doidStatus: 'not-mapped', batch: 'AI', icd10: 'J30.9',
    name: { ar: 'التهاب الأنف التحسسي', en: 'Allergic rhinitis', fr: 'Rhinite allergique' },
    summary: { ar: 'حساسية قد تسبب جفافًا أو تهيجًا بالحلق مع احتقان أو عطس.', en: 'Allergy that can irritate or dry the throat with congestion or sneezing.', fr: 'Allergie pouvant irriter ou assécher la gorge avec congestion ou éternuements.' },
    muscleGroups: ['throat'], regions: ['head_neck'], symptoms: [],
    redFlags: { ar: '', en: '', fr: '' }, medlinePlusUrl: '', sources: [],
  },
  {
    id: 'local:dehydration', doid: null, doidStatus: 'not-mapped', batch: 'AI', icd10: 'E86.0',
    name: { ar: 'الجفاف', en: 'Dehydration', fr: 'Déshydratation' },
    summary: { ar: 'نقص السوائل قد يسبب صداعًا وعطشًا وجفاف الفم ودوخة.', en: 'Low body fluid can cause headache, thirst, dry mouth, and dizziness.', fr: 'Un manque de liquides peut provoquer céphalées, soif, bouche sèche et vertiges.' },
    muscleGroups: [], regions: ['torso_front', 'head_neck'], symptoms: [],
    redFlags: { ar: 'إغماء أو ارتباك أو عدم القدرة على شرب السوائل يحتاج تقييمًا عاجلًا.', en: 'Fainting, confusion, or inability to drink requires urgent assessment.', fr: 'Malaise, confusion ou impossibilité de boire nécessite une évaluation urgente.' }, medlinePlusUrl: '', sources: [],
  },
  {
    id: 'local:heat-exhaustion', doid: null, doidStatus: 'not-mapped', batch: 'AI', icd10: 'T67.5',
    name: { ar: 'الإجهاد الحراري', en: 'Heat exhaustion', fr: 'Épuisement dû à la chaleur' },
    summary: { ar: 'إجهاد بسبب الحرارة قد يسبب صداعًا ودوخة وتعرقًا وضعفًا.', en: 'Heat-related illness causing headache, dizziness, sweating, and weakness.', fr: 'Trouble lié à la chaleur provoquant céphalées, vertiges, sueurs et faiblesse.' },
    muscleGroups: [], regions: ['torso_front', 'head_neck'], symptoms: [],
    redFlags: { ar: 'ارتباك أو فقدان الوعي أو تدهور سريع مع الحرارة يحتاج طوارئ.', en: 'Confusion, loss of consciousness, or rapid deterioration with heat requires emergency care.', fr: 'Confusion, perte de connaissance ou aggravation rapide avec chaleur nécessite les urgences.' }, medlinePlusUrl: '', sources: [],
  },
  {
    id: 'local:tension-myositis', doid: null, doidStatus: 'not-mapped', batch: 'AI', icd10: 'M79.1',
    name: { ar: 'متلازمة ألم التوتر العضلي', en: 'Tension myositis syndrome', fr: 'Syndrome de tension myofasciale' },
    summary: { ar: 'ألم عضلي مرتبط بالتوتر أو الإجهاد؛ لا ينبغي اعتباره تشخيصًا من الأعراض وحدها.', en: 'Muscle pain associated with stress or tension; symptoms alone do not establish a diagnosis.', fr: 'Douleur musculaire associée au stress ou à la tension ; les symptômes seuls ne suffisent pas au diagnostic.' },
    muscleGroups: ['back', 'neck'], regions: ['back', 'head_neck'], symptoms: [],
    redFlags: { ar: '', en: '', fr: '' }, medlinePlusUrl: '', sources: [],
  },
  {
    id: 'local:piriformis-syndrome', doid: null, doidStatus: 'not-mapped', batch: 'AI', icd10: 'G57.0',
    name: { ar: 'متلازمة العضلة الكمثرية', en: 'Piriformis syndrome', fr: 'Syndrome du piriforme' },
    summary: { ar: 'تهيج حول العصب الوركي في منطقة الأرداف قد يسبب ألمًا يمتد للساق.', en: 'Irritation around the sciatic nerve in the buttock that can cause pain into the leg.', fr: 'Irritation autour du nerf sciatique dans la fesse pouvant irradier vers la jambe.' },
    muscleGroups: ['gluteal', 'legs'], regions: ['lower_limb', 'back'], symptoms: [],
    redFlags: { ar: 'ضعف متزايد أو فقدان التحكم في البول أو البراز يحتاج تقييمًا عاجلًا.', en: 'Progressive weakness or loss of bladder/bowel control needs urgent assessment.', fr: 'Faiblesse progressive ou perte du contrôle urinaire/fécal nécessite une évaluation urgente.' }, medlinePlusUrl: '', sources: [],
  },
  {
    id: 'local:thoracic-outlet', doid: null, doidStatus: 'not-mapped', batch: 'AI', icd10: 'G54.0',
    name: { ar: 'متلازمة مخرج الصدر', en: 'Thoracic outlet syndrome', fr: 'Syndrome du défilé thoracobrachial' },
    summary: { ar: 'ضغط على أعصاب أو أوعية بين الرقبة والكتف قد يسبب تنميلًا أو ثقلًا بالذراع.', en: 'Compression of nerves or vessels between the neck and shoulder can cause arm tingling or heaviness.', fr: 'Compression de nerfs ou de vaisseaux entre le cou et l’épaule pouvant causer fourmillements ou lourdeur du bras.' },
    muscleGroups: ['neck', 'shoulder', 'hands'], regions: ['head_neck', 'upper_limb'], symptoms: [],
    redFlags: { ar: 'تورم أو تغير لون الذراع المفاجئ أو ضعف شديد يحتاج تقييمًا عاجلًا.', en: 'Sudden arm swelling, color change, or marked weakness needs urgent assessment.', fr: 'Gonflement soudain du bras, changement de couleur ou faiblesse importante nécessite une évaluation urgente.' }, medlinePlusUrl: '', sources: [],
  },
];

const DIFFUSE_IDS = new Set(['doid:1490', 'doid:8505', 'doid:8505-doms']);

const CONDITIONS: MedicalCondition[] = [
  ...BASE_CONDITIONS,
  ...ORGAN_CONDITIONS,
  ...REGIONAL_CONDITIONS,
  ...SUPPLEMENTAL_CONDITIONS,
].map((c) => (DIFFUSE_IDS.has(c.id) ? { ...c, diffuse: true } : c));

const SYMPTOMS = (symptomsData as { symptoms: MedicalSymptom[] }).symptoms;

// ============================================================================
// خريطة الجهة (يمين / شمال / وسط) لكل حالة بطنية
// ----------------------------------------------------------------------------
// بتُستخدم في scoreCondition عشان تعاقب الحالات اللي في الجهة الغلط.
// ============================================================================
const ABDOMEN_SIDE_MAP: Record<string, 'right' | 'left' | 'center' | 'both'> = {
  'doid:appendicitis': 'right',        // الزائدة → أسفل يمين
  'doid:gallstones': 'right',          // المرارة → أعلى يمين
  'doid:cholecystitis-acute': 'right', // التهاب المرارة الحاد → أعلى يمين
  'doid:diverticulitis': 'left',       // الرتوج → أسفل شمال
  'doid:acute-diverticulitis': 'left', // الرتوج الحاد → أسفل شمال
  'doid:ibs': 'both',                  // القولون العصبي → ممكن أي ناحية
  'doid:gastritis': 'center',          // المعدة → وسط/أعلى
  'doid:peptic-ulcer': 'center',       // القرحة → وسط/أعلى
  'doid:duodenal-ulcer': 'center',     // قرحة الاثني عشر → وسط/أعلى
  'doid:gastroenteritis': 'both',      // النزلة المعوية → كل البطن
  'doid:uti': 'center',                // المسالك → أسفل وسط
  'doid:kidney-stone': 'both',         // حصى الكلى → خاصرة أي ناحية
  'doid:ureteral-stone': 'both',       // حصى الحالب → خاصرة أي ناحية
  'doid:pyelonephritis': 'both',       // التهاب الكلى → خاصرة أي ناحية
  'doid:ovarian-cyst': 'both',         // كيس المبيض → أي ناحية
  'doid:endometriosis': 'center',      // بطانة الرحم → وسط الحوض
  'doid:pcos': 'both',                 // تكيس المبايض → أي ناحية
  'doid:prostatitis': 'center',        // البروستاتا → وسط أسفل
  'doid:hepatitis': 'right',           // الكبد → أعلى يمين
  'doid:pancreatitis': 'center',       // البنكرياس → وسط
  'doid:gerd-organ': 'center',         // الارتجاع → وسط
  'doid:angina': 'center',             // الذبحة → وسط الصدر
};

// ============================================================================
// قاموس الكلمات المفتاحية والعامية المصرية
// ============================================================================

interface KeywordEntry {
  keywords: string[];
  colloquial: string[];
}

const KEYWORDS_MAP: Record<string, KeywordEntry> = {
  // ==========================================================================
  // القسم 1: أمراض العظام والعضلات (من diseases.json) — 25 حالة
  // ==========================================================================

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

  'doid:8505': {
    keywords: [
      'ألم عضلي', 'ألم في العضلات', 'ميالجيا', 'وجع عضلي', 'ألم عام',
      'ألم في كل العضلات', 'تعب عضلي',
      'myalgia', 'muscle pain', 'muscular pain',
    ],
    colloquial: ['عضلاتي بتوجعني', 'جسمي كله بوجع', 'حاسس بألم في عضلاتي'],
  },

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

  'doid:11067': {
    keywords: [
      'التهاب الأوتار', 'التهاب الوتر', 'وجع في الوتر',
      'التهاب وتر أخيل', 'التهاب أوتار الكتف', 'تندينيت',
      'tendinitis', 'tendonitis', 'tendon pain',
    ],
    colloquial: ['وتري بوجعني', 'حاسس بألم في الوتر', 'وجع في وتر رجلي'],
  },

  'doid:0050896': {
    keywords: ['ألم المفاصل', 'أرثالجا', 'وجع المفاصل', 'joint pain', 'arthralgia'],
    colloquial: ['مفاصلي بتوجعني', 'وجع في مفاصلي'],
  },

  'doid:9350': {
    keywords: [
      'اعتلال الأعصاب', 'تنميل الأطراف', 'حرقان في القدم',
      'التنميل المزمن', 'ألم عصبي مزمن', 'neuropathy',
      'peripheral neuropathy', 'tingling',
    ],
    colloquial: [
      'رجليّ بتتنمّل', 'إيديا ورجليا بتتنمّل', 'حاسس بحرقان في رجلي',
    ],
  },

  'doid:10629': {
    keywords: [
      'التواء الكاحل', 'لوي الكاحل', 'إصابة الكاحل', 'كاحل',
      'ankle sprain', 'sprained ankle', 'ankle injury',
    ],
    colloquial: ['كوستي', 'كاحلي اتلوى', 'كوستي بوجعني'],
  },

  'doid:7148': {
    keywords: [
      'ألم اليد', 'ألم الرسغ', 'إجهاد متكرر', 'وجع الرسغ',
      'hand pain', 'wrist pain', 'repetitive strain',
    ],
    colloquial: ['إيدي بتوجعني', 'رسغي بوجعني', 'إيدي تعبت من الكتابة'],
  },

  'doid:8398-oa': {
    keywords: [
      'خشونة المفاصل', 'الفصال العظمي', 'تآكل الغضروف', 'خشونة',
      'المفاصل', 'وجع مفاصل', 'تآكل المفاصل',
      'osteoarthritis', 'OA', 'degenerative joint disease',
    ],
    colloquial: ['مفاصلي بتوجعني', 'مفاصلي بتطلع صوت', 'حاسس بخشونة في مفاصلي'],
  },

  'doid:10763': {
    keywords: [
      'ضغط الدم', 'ارتفاع ضغط الدم', 'الضغط', 'ضغط عالي',
      'hypertension', 'high blood pressure',
    ],
    colloquial: ['عندي ضغط', 'الضغط عالي', 'حاسس بضغط في دماغي', 'عندي صداع من الضغط'],
  },

  'doid:12353': {
    keywords: [
      'الارتجاع المريئي', 'الحموضة', 'حرقة المعدة', 'ارتجاع',
      'gastroesophageal reflux', 'GERD', 'heartburn', 'acid reflux',
    ],
    colloquial: [
      'حاسس بحموضة', 'حرقة في صدري', 'الأكل بيرجع لي', 'حاسس بحرقة في معدتي',
    ],
  },

  // ==========================================================================
  // القسم 2: أمراض الأعضاء الداخلية (من organConditions.json) — 15 حالة
  // ==========================================================================

  'doid:appendicitis': {
    keywords: [
      'التهاب الزائدة', 'الزائدة الدودية', 'زائدة', 'appendicitis',
      'ألم أسفل يمين البطن', 'ألم حول السرة',
      'يمين البطن', 'جنب يميني', 'أسفل يمين',
    ],
    colloquial: [
      'وجع في أسفل يمين بطني', 'بطني بتوجعني من ناحية اليمين',
      'وجع حول السرة', 'حاسس بوجع في بطني وجاي على اليمين',
      'بطني من يمين بتوجعني', 'بطني بتوجعني من نحية اليمين',
      'بطني بتوجعني من جهة اليمين', 'ألم في أسفل يمين البطن',
      'وجع في يمين بطني',
    ],
  },

  'doid:gastritis': {
    keywords: [
      'التهاب المعدة', 'عسر الهضم', 'حرقة المعدة', 'gastritis', 'dyspepsia',
      'ألم أعلى البطن', 'حموضة', 'انتفاخ', 'وسط البطن',
    ],
    colloquial: [
      'معدتي بتوجعني', 'حاسس بحرقة في معدتي',
      'بطني من فوق بتوجعني', 'حاسس بانتفاخ بعد الأكل',
      'معدتي تعبانة', 'بطني من وسط بتوجعني',
    ],
  },

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

  'doid:diverticulitis': {
    keywords: [
      'التهاب الرتوج', 'التهاب القولون', 'diverticulitis',
      'ألم أسفل يسار البطن', 'حرارة مع ألم البطن',
      'شمال البطن', 'جنب شمالي', 'أسفل شمال',
    ],
    colloquial: [
      'وجع في أسفل يسار بطني', 'بطني بتوجعني من ناحية الشمال',
      'حاسس بوجع في بطني مع حرارة',
      'بطني من شمال بتوجعني', 'بطني بتوجعني من نحية الشمال',
      'بطني بتوجعني من جهة الشمال', 'ألم في أسفل شمال البطن',
      'وجع في شمال بطني',
    ],
  },

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

  'doid:gallstones': {
    keywords: [
      'حصى المرارة', 'التهاب المرارة', 'gallstones', 'cholecystitis',
      'ألم أعلى يمين البطن', 'ألم بعد الأكل الدسم',
      'يمين البطن', 'جنب يميني', 'أعلى يمين',
    ],
    colloquial: [
      'عندي حصى في المرارة', 'وجع في يمين بطني من فوق',
      'بطني بتوجعني بعد الأكل الدسم', 'وجع في المرارة',
      'بطني من يمين فوق بتوجعني', 'ألم في أعلى يمين البطن',
    ],
  },

  'doid:hepatitis': {
    keywords: [
      'التهاب الكبد', 'hepatitis', 'ألم الكبد', 'اصفرار',
      'يرقان', 'jaundice', 'يمين البطن', 'أعلى يمين',
    ],
    colloquial: [
      'عندي التهاب في الكبد', 'كبدي بتوجعني',
      'عيوني بقت صفراء', 'حاسس بإجهاد شديد ووجع في جنبي',
      'جنبي اليمين بتوجعني',
    ],
  },

  'doid:pancreatitis': {
    keywords: [
      'التهاب البنكرياس', 'pancreatitis',
      'ألم أعلى البطن ينتقل للظهر', 'وسط البطن', 'حزامي',
    ],
    colloquial: [
      'عندي التهاب في البنكرياس', 'بطني بتوجعني وينزل على ضهري',
      'وجع في بطني من فوق وبينزل على ضهري',
    ],
  },

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

  'doid:kidney-stone': {
    keywords: [
      'حصى الكلى', 'kidney stones',
      'ألم في الخاصرة', 'ألم الكلى', 'دم في البول',
      'جنب', 'خاصرة',
    ],
    colloquial: [
      'عندي حصى في الكلى', 'جنبي بتوجعني بشكل شديد',
      'وجع في خاصرتي', 'حاسس بوجع في كليتي',
    ],
  },

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

  // ==========================================================================
  // القسم 3: الحالات الجديدة في diseases.json — 10 حالات
  // ==========================================================================

  'doid:cluster-headache': {
    keywords: [
      'الصداع العنقودي', 'صداع عنقودي', 'cluster headache',
      'صداع شديد حول العين', 'صداع نصفي شديد',
    ],
    colloquial: [
      'عندي صداع شديد حول عيني', 'صداع بيجي في نوبات',
      'حاسس بوجع شديد في عيني', 'صداع عنقودي',
    ],
  },

  'doid:sinusitis': {
    keywords: [
      'التهاب الجيوب', 'التهاب الجيوب الأنفية', 'sinusitis', 'sinus',
      'ألم في الوجه', 'ضغط في الجبهة', 'انسداد الأنف', 'رشح',
    ],
    colloquial: [
      'جيوبي بتوجعني', 'حاسس بضغط في جبهتي',
      'مناخيري مسدودة ووجع في وشي', 'وجع في عضم وشي',
      'حاسس بوجع في جيوبي الأنفية', 'جيوبي الأنفية بتوجعني',
      'جيوبي الانفية بتوجعني',
    ],
  },

  'doid:otitis-media': {
    keywords: [
      'التهاب الأذن', 'التهاب الأذن الوسطى', 'otitis media',
      'ألم الأذن', 'ear infection', 'ear pain', 'otalgia',
    ],
    colloquial: [
      'ودني بتوجعني', 'أذني بتوجعني', 'وجع في أذني',
      'وجع في ودني', 'حاسس بوجع في وdني', 'أذني بتصرخ',
      'حاسس بضغط في أذني',
    ],
  },

  'doid:toothache': {
    keywords: [
      'ألم الأسنان', 'toothache', 'وجع سن', 'ألم في الضرس',
      'dental pain', 'وجع ضرس',
    ],
    colloquial: [
      'سناني بتوجعني', 'ضرسي بيوجعني', 'وجع في ضرسي',
      'وجع في سني', 'حاسس بوجع في سناني',
    ],
  },

  'doid:pharyngitis': {
    keywords: [
      'التهاب الحلق', 'pharyngitis', 'sore throat',
      'وجع في الزور', 'ألم الحلق', 'التهاب البلعوم',
    ],
    colloquial: [
      'زوري بيوجعني', 'حلقي بيوجعني', 'وجع في حلقي',
      'صعوبة في البلع', 'زوري تعبان', 'حلقي تعبان',
    ],
  },

  'doid:gout': {
    keywords: [
      'النقرس', 'gout', 'حمض اليوريك',
      'ألم إبهام القدم', 'تورم مفصل مع احمرار',
    ],
    colloquial: [
      'عندي نقرس', 'إبهام رجلي بيوجعني', 'صباعي بيوجعني بشدة',
      'مفصل بيوجعني ووارم وأحمر', 'حاسس بوجع في صباع رجلي',
    ],
  },

  'doid:bursitis': {
    keywords: [
      'التهاب الجراب', 'bursitis', 'التهاب كيس المفصل',
      'ألم في الكتف', 'ألم في الركبة', 'ألم في الورك',
    ],
    colloquial: [
      'كتفي بيوجعني ووارم', 'ركبتي وارمة وبتوجعني',
      'حاسس بوجع في جراب المفصل',
    ],
  },

  'doid:varicose-veins': {
    keywords: [
      'الدوالي', 'توسع الأوردة', 'varicose veins',
      'أوردة متضخمة', 'أوردة الساق',
    ],
    colloquial: [
      'عندي دوالي', 'رجلي فيها عروق بارزة',
      'رجلي بتوجعني من الدوالي', 'رجلي تقيلة',
    ],
  },

  'doid:shingles': {
    keywords: [
      'الحزام الناري', 'القوباء المنطقية', 'shingles', 'herpes zoster',
      'طفح مؤلم', 'حويصلات على الجلد',
    ],
    colloquial: [
      'عندي حزام ناري', 'طلعلي طفح مؤلم', 'حاسس بحرقان وطفح',
      'حزام ناري على ضهري', 'طلعلي حبوب مؤلمة على جنبي',
    ],
  },

  'doid:psoriatic-arthritis': {
    keywords: [
      'الصدفية المفصلية', 'psoriatic arthritis',
      'صدفية', 'psoriasis', 'التهاب مفاصل مع صدفية',
    ],
    colloquial: [
      'عندي صدفية في جلدي ومفاصلي بتوجعني',
      'جلدي فيه قشور ومفاصلي وارمة', 'عندي صدفية',
    ],
  },

  // ==========================================================================
  // القسم 4: الحالات الجديدة في organConditions.json — 10 حالات
  // ==========================================================================

  'doid:cholecystitis-acute': {
    keywords: [
      'التهاب المرارة الحاد', 'acute cholecystitis',
      'التهاب المرارة', 'ألم شديد أعلى يمين البطن',
      'يمين البطن', 'أعلى يمين',
    ],
    colloquial: [
      'المرارة بتوجعني بشدة', 'عندي التهاب في المرارة',
      'وجع شديد في يمين بطني مع حرارة',
      'بطني من يمين فوق بتوجعني بشدة',
    ],
  },

  'doid:duodenal-ulcer': {
    keywords: [
      'قرحة الاثني عشر', 'duodenal ulcer',
      'قرحة الأمعاء', 'حرقة في أعلى البطن', 'وسط البطن',
    ],
    colloquial: [
      'عندي قرحة في الاثني عشر', 'حرقة في بطني بتروح مع الأكل',
      'وجع في أعلى بطني',
    ],
  },

  'doid:acute-diverticulitis': {
    keywords: [
      'التهاب الرتج الحاد', 'acute diverticulitis',
      'التهاب الرتوج الحاد', 'ألم شديد أسفل يسار البطن',
      'شمال البطن', 'أسفل شمال',
    ],
    colloquial: [
      'عندي التهاب حاد في القولون',
      'وجع شديد في يسار بطني مع حرارة',
      'بطني من شمال تحت بتوجعني بشدة',
    ],
  },

  'doid:pyelonephritis': {
    keywords: [
      'التهاب الكلى', 'pyelonephritis',
      'التهاب الحويضة والكلية', 'ألم في الخاصرة مع حرارة',
      'جنب', 'خاصرة',
    ],
    colloquial: [
      'عندي التهاب في كليتي', 'جنبي بتوجعني مع حرارة',
      'حاسس بوجع في خاصرتي وقشعريرة',
    ],
  },

  'doid:ureteral-stone': {
    keywords: [
      'حصى الحالب', 'ureteral stone', 'حصوة في الحالب',
      'ألم شديد في الخاصرة ينتقل لأسفل', 'جنب', 'خاصرة',
    ],
    colloquial: [
      'عندي حصوة في الحالب', 'جنبي بتوجعني وبتنزل لتحت',
      'وجع شديد بينزل من جنبي لبطني',
    ],
  },

  'doid:prostatitis': {
    keywords: [
      'التهاب البروستاتا', 'prostatitis',
      'ألم في الحوض', 'صعوبة التبول', 'حرقان مع التبول',
    ],
    colloquial: [
      'عندي التهاب في البروستاتا',
      'حاسس بوجع في الحوض', 'بتبول بصعوبة',
    ],
  },

  'doid:pcos': {
    keywords: [
      'تكيس المبايض', 'PCOS', 'polycystic ovary syndrome',
      'عدم انتظام الدورة', 'زيادة الشعر',
    ],
    colloquial: [
      'عندي تكيس في المبايض', 'الدورة مش منتظمة',
      'حاسس بوجع في المبايض',
    ],
  },

  'doid:hyperthyroidism': {
    keywords: [
      'فرط نشاط الغدة الدرقية', 'hyperthyroidism',
      'زيادة نشاط الدرقية', 'خفقان', 'فقدان وزن', 'تعرق',
    ],
    colloquial: [
      'عندي فرط في نشاط الغدة', 'قلبي بيدق بسرعة',
      'بعرق كتير وبفقد وزني',
    ],
  },

  'doid:hypothyroidism': {
    keywords: [
      'قصور الغدة الدرقية', 'hypothyroidism',
      'نقص نشاط الدرقية', 'تعب مستمر', 'زيادة وزن', 'جفاف الجلد',
    ],
    colloquial: [
      'عندي قصور في الغدة', 'دایمًا تعبان',
      'بزداد في الوزن وبحس ببرد',
    ],
  },

  'doid:pericarditis': {
    keywords: [
      'التهاب التامور', 'pericarditis',
      'التهاب غشاء القلب', 'ألم صدر يزيد مع الشهيق',
    ],
    colloquial: [
      'عندي التهاب في غشاء القلب',
      'صدري بيوجعني لما بشهق', 'ألم في الصدر بيزيد مع النفس',
    ],
  },

  'local:aortic-aneurysm': { keywords: ['تمدد الشريان الأورطي', 'تمدد الأبهر', 'aortic aneurysm'], colloquial: ['ألم شديد مفاجئ في بطني', 'ألم شديد مفاجئ في صدري'] },
  'local:edema': { keywords: ['وذمة', 'تورم', 'edema', 'swelling'], colloquial: ['رجلي وارمة', 'رجلي متورمة', 'تورم الرجل'] },
  'local:myocardial-infarction': { keywords: ['جلطة قلبية', 'احتشاء عضلة القلب', 'myocardial infarction', 'heart attack'], colloquial: ['ضغط شديد في صدري', 'ألم صدر شديد'] },
  'local:dry-eye-syndrome': { keywords: ['جفاف العين', 'جفاف عيني', 'dry eye', 'dry eye syndrome'], colloquial: ['عيني ناشفة', 'عيني بتحرق'] },
  'local:sjogren-syndrome': { keywords: ['شوغرن', 'متلازمة شوغرن', 'sjogren syndrome'], colloquial: ['عيني وفمي ناشفين'] },
  'local:glaucoma': { keywords: ['جلوكوما', 'مياه زرقاء', 'glaucoma'], colloquial: ['ضغط في عيني', 'ألم شديد في عيني'] },
  'local:diabetic-neuropathy': { keywords: ['اعتلال الأعصاب السكري', 'diabetic neuropathy'], colloquial: ['حرقان وتنميل في إيدي بسبب السكر', 'اعتلال عصبي سكري'] },
  'local:type-2-diabetes': { keywords: ['السكري النوع الثاني', 'السكر', 'type 2 diabetes', 'diabetes'], colloquial: ['عندي سكر'] },
  'local:allergic-rhinitis': { keywords: ['حساسية الأنف', 'التهاب الأنف التحسسي', 'allergic rhinitis'], colloquial: ['حلق ناشف مع حساسية', 'حلق ناشف وبعطس'] },
  'local:dehydration': { keywords: ['الجفاف', 'dehydration'], colloquial: ['عطشان ومش شارب مياه', 'فمي ناشف من قلة الميه'] },
  'local:heat-exhaustion': { keywords: ['الإجهاد الحراري', 'heat exhaustion'], colloquial: ['تعبت من الحر', 'دوخة من الحر'] },
  'local:tension-myositis': { keywords: ['ألم التوتر العضلي', 'tension myositis syndrome'], colloquial: ['عضلاتي مشدودة من التوتر'] },
  'local:piriformis-syndrome': { keywords: ['متلازمة العضلة الكمثرية', 'piriformis syndrome'], colloquial: ['وجع في المؤخرة نازل على رجلي'] },
  'local:thoracic-outlet': { keywords: ['متلازمة مخرج الصدر', 'thoracic outlet syndrome'], colloquial: ['إيدي بتنمل مع رفعها', 'ثقل في ذراعي'] },
};

// ============================================================================
// حالات عامة (Generic)
// ============================================================================
const GENERIC_CONDITION_IDS = new Set<string>([
  'doid:8505',
  'doid:8505-doms',
  'doid:1490',
  'doid:0050896',
  'doid:9350',
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
// كشف الجهة (يمين / شمال / وسط) من النص
// ============================================================================

const RIGHT_WORDS = ['يمين', 'يميني', 'اليمين', 'يمنية', 'ناحية اليمين', 'جهة اليمين', 'نحيه اليمين', 'right'];
const LEFT_WORDS = ['شمال', 'شمالي', 'الشمال', 'شمالية', 'يسار', 'يساري', 'اليسار', 'ناحية الشمال', 'جهة الشمال', 'نحيه الشمال', 'left'];

function detectSide(text: string): 'right' | 'left' | null {
  const n = normalizeArabic(text);
  const hasRight = RIGHT_WORDS.some((w) => n.includes(normalizeArabic(w)));
  const hasLeft = LEFT_WORDS.some((w) => n.includes(normalizeArabic(w)));
  if (hasRight && !hasLeft) return 'right';
  if (hasLeft && !hasRight) return 'left';
  return null;
}

// ============================================================================
// محرك البحث الذكي
// ============================================================================

function scoreCondition(
  condition: MedicalCondition,
  normalizedQuery: string,
  queryTokens: string[],
  querySide: 'right' | 'left' | null = null,
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

  if (normalizedQuery === nameAr) { score += 1000; matchedTerms.push('name_exact'); }
  if (colloquial.some((c) => c === normalizedQuery)) { score += 900; matchedTerms.push('colloquial_exact'); }
  if (keywords.some((k) => k === normalizedQuery)) { score += 800; matchedTerms.push('keyword_exact'); }

  if (nameAr.includes(normalizedQuery)) { score += 500; matchedTerms.push('name_includes'); }
  if (colloquial.some((c) => c.includes(normalizedQuery))) { score += 450; matchedTerms.push('colloquial_includes'); }
  if (keywords.some((k) => k.includes(normalizedQuery))) { score += 400; matchedTerms.push('keyword_includes'); }
  if (nameEn.includes(normalizedQuery) || nameFr.includes(normalizedQuery)) { score += 350; matchedTerms.push('name_en_fr'); }
  if (summaryAr.includes(normalizedQuery)) { score += 100; matchedTerms.push('summary'); }

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

  if (condition.diffuse && queryTokens.length >= 1) {
    const hasLocalRegion = queryTokens.some(
      (t) => regionKeywords.includes(t) && condition.regions.includes(t),
    );
    if (!hasLocalRegion) score *= 0.6;
  }

  if (colloquial.some((c) => c === normalizedQuery)) {
    score += 500;
    matchedTerms.push('colloquial_bonus');
  }

  if (GENERIC_CONDITION_IDS.has(condition.id)) {
    const hasLocalRegion = queryTokens.some((t) => regionKeywords.includes(t));
    if (hasLocalRegion) {
      score *= 0.4;
      matchedTerms.push('generic_penalty');
    }
  }

  // 🆕 عقوبة/مكافأة الجهة (يمين / شمال)
  if (querySide) {
    const condSide = ABDOMEN_SIDE_MAP[condition.id];
    if (condSide && condSide !== 'both' && condSide !== 'center') {
      if (condSide !== querySide) {
        // الحالة في الجهة الغلط → خصم كبير
        score *= 0.1;
        matchedTerms.push('wrong_side_penalty');
      } else {
        // الحالة في الجهة الصح → مكافأة
        score += 300;
        matchedTerms.push('right_side_bonus');
      }
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
  const querySide = detectSide(normalizedQuery);
  const results: SearchResult[] = [];

  for (const condition of conditions) {
    const result = scoreCondition(condition, normalizedQuery, queryTokens, querySide);
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

export function getAbdomenSideMap(): Record<string, string> {
  return { ...ABDOMEN_SIDE_MAP };
}

// ============================================================================
// Stubs للتوافق مع hooks القديمة
// ============================================================================

export function getTaxonomy() { return { regions: [], subRegions: [], structures: [] }; }
export function getSubRegions(_regionId: string) { return []; }
export function getStructure(_structureId: string) { return null; }
export function getTaxonomyStats() { return { regions: 0, subRegions: 0, structures: 0 }; }
export function getTaxonomyNotice(_lang: Language) { return ''; }
