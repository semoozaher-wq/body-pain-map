// services/aiAssistant/lexicon.ts
// ============================================================================
// معجم المساعد الذكي — متعدد اللغات (عربي / إنجليزي / فرنسي)
// ----------------------------------------------------------------------------
// يحتوي على:
//   • BODY_REGIONS  : مناطق الجسم + مرادفاتها (فصحى + عامية مصرية) + ربطها
//                     بمعرّفات مجموعات العضلات المستخدمة في التطبيق (مثل lower-back).
//   • SYMPTOM_TERMS : أعراض مرجعية مربوطة بأكواد HPO لتُطابَق مع المكتبة الطبية.
//   • RED_FLAG_TERMS: علامات إنذار (خطرة) مع تصنيف درجة الاستعجال.
//   • SEVERITY_WORDS: كلمات تدل على شدّة الألم (خفيف / متوسط / شديد).
//   • DURATION_WORDS: كلمات تدل على المدة (ساعات / أيام / أسابيع / شهور).
//
// كل شيء محلي بالكامل — لا شبكة ولا مفاتيح API. المعجم يُطبَّع (normalize)
// عند المقارنة حتى يعمل مع التشكيل والهمزات والاختلافات الإملائية.
// ============================================================================

export type Lang = 'ar' | 'en' | 'fr';
export type LocalizedText = { ar: string; en: string; fr: string };

/** مناطق الجسم المرجعية (نفس مفردات diseaseLibrary). */
export type BodyRegionKey =
  | 'back'
  | 'head_neck'
  | 'lower_limb'
  | 'torso_front'
  | 'upper_limb';

/** منطقة جسم مكتشفة في كلام المستخدم. */
export interface RegionTerm {
  /** معرّف مجموعة العضلات في التطبيق (مفتاح groups في anatomyPainMap.json). */
  id: string;
  /** المنطقة المرجعية الواسعة. */
  region: BodyRegionKey;
  /** الاسم المعروض بثلاث لغات. */
  label: LocalizedText;
  /** كلمات مفتاحية بكل لغة (تشمل العامية المصرية). */
  keywords: Record<Lang, string[]>;
}

/** عرض مرجعي مربوط بكود HPO. */
export interface SymptomTerm {
  id: string; // مثال: hpo:0003418
  label: LocalizedText;
  redFlag: boolean;
  keywords: Record<Lang, string[]>;
}

/** علامة إنذار (خطرة). */
export interface RedFlagTerm {
  id: string;
  /** emergency = طوارئ فوراً، urgent = تقييم عاجل جداً. */
  level: 'emergency' | 'urgent';
  label: LocalizedText;
  keywords: Record<Lang, string[]>;
}

// ---------------------------------------------------------------------------
// 1) مناطق الجسم
// ---------------------------------------------------------------------------
export const BODY_REGIONS: RegionTerm[] = [
  {
    id: 'head',
    region: 'head_neck',
    label: { ar: 'الرأس', en: 'Head', fr: 'Tête' },
    keywords: {
      ar: ['راسي', 'الراس', 'دماغي', 'فروة', 'جبهتي', 'صدغي', 'وجع الراس', 'صداع'],
      en: ['head', 'forehead', 'temple', 'skull'],
      fr: ['tête', 'front', 'tempe', 'crâne'],
    },
  },
  {
    id: 'neck',
    region: 'head_neck',
    label: { ar: 'الرقبة', en: 'Neck', fr: 'Cou' },
    keywords: {
      ar: ['رقبتي', 'الرقبة', 'رقبه', 'الرقاب', 'تقل في رقبتي'],
      en: ['neck', 'cervical'],
      fr: ['cou', 'nuque', 'cervical'],
    },
  },
  {
    id: 'upper-back',
    region: 'back',
    label: { ar: 'أعلى الظهر', en: 'Upper back', fr: 'Haut du dos' },
    keywords: {
      ar: ['اعلى ضهري', 'أعلى الظهر', 'بين كتافي', 'بين الكتفين', 'الظهر العلوي', 'ضهري من فوق'],
      en: ['upper back', 'between the shoulders', 'thoracic'],
      fr: ['haut du dos', 'entre les omoplates', 'thoracique'],
    },
  },
  {
    id: 'lower-back',
    region: 'back',
    label: { ar: 'أسفل الظهر', en: 'Lower back', fr: 'Bas du dos' },
    keywords: {
      ar: ['اسفل ضهري', 'أسفل الظهر', 'وسط ضهري', 'قطني', 'القطنية', 'ضهري', 'ظهري', 'الظهر', 'اسفل الظهر', 'الفقرات', 'الحرقفة', 'حقوي'],
      en: ['lower back', 'low back', 'lumbar', 'lumbago'],
      fr: ['bas du dos', 'lombaire', 'lombalgie'],
    },
  },
  {
    id: 'chest',
    region: 'torso_front',
    label: { ar: 'الصدر', en: 'Chest', fr: 'Poitrine' },
    keywords: {
      ar: ['صدري', 'الصدر', 'قلبي', 'القلب', 'منطقة القلب', 'قص', 'القص'],
      en: ['chest', 'sternum', 'heart area'],
      fr: ['poitrine', 'thorax', 'sternum', 'cœur'],
    },
  },
  {
    id: 'abs',
    region: 'torso_front',
    label: { ar: 'البطن', en: 'Abdomen', fr: 'Abdomen' },
    keywords: {
      ar: ['بطني', 'البطن', 'المعدة', 'معدتي', 'المصران', 'القولون', 'الكرش', 'تحت ضلوعي'],
      en: ['abdomen', 'stomach', 'belly', 'tummy', 'gut'],
      fr: ['abdomen', 'ventre', 'estomac'],
    },
  },
  {
    id: 'obliques',
    region: 'torso_front',
    label: { ar: 'الخواصر (الجانب)', en: 'Flank / side', fr: 'Flanc / côté' },
    keywords: {
      ar: ['جنبي', 'خواصري', 'الخاصرة', 'الجانب', 'على جنب'],
      en: ['flank', 'side', 'waist'],
      fr: ['flanc', 'côté', 'taille'],
    },
  },
  {
    id: 'deltoids',
    region: 'upper_limb',
    label: { ar: 'الكتف', en: 'Shoulder', fr: 'Épaule' },
    keywords: {
      ar: ['كتفي', 'الكتف', 'كتف', 'الاكتاف', 'أكتافي', 'مفصل الكتف'],
      en: ['shoulder', 'deltoid'],
      fr: ['épaule', 'deltoïde'],
    },
  },
  {
    id: 'biceps',
    region: 'upper_limb',
    label: { ar: 'الذراع العلوي', en: 'Upper arm', fr: 'Bras supérieur' },
    keywords: {
      ar: ['دراعي', 'الذراع', 'عضدي', 'الباي', 'العضد', 'ذراعي'],
      en: ['upper arm', 'bicep', 'biceps', 'arm'],
      fr: ['bras', 'biceps', 'humérus'],
    },
  },
  {
    id: 'forearm',
    region: 'upper_limb',
    label: { ar: 'الساعد', en: 'Forearm', fr: 'Avant-bras' },
    keywords: {
      ar: ['ساعدي', 'الساعد', 'الزند', 'كوعي', 'الكوع', 'المرفق', 'مرفقي'],
      en: ['forearm', 'elbow', 'wrist area'],
      fr: ['avant-bras', 'coude'],
    },
  },
  {
    id: 'hands',
    region: 'upper_limb',
    label: { ar: 'اليد والرسغ', en: 'Hand / wrist', fr: 'Main / poignet' },
    keywords: {
      ar: ['ايدي', 'يدي', 'اليد', 'الرسغ', 'رسغي', 'الكف', 'كفي', 'الصوابع', 'صوابعي', 'أصابعي', 'الأصابع'],
      en: ['hand', 'wrist', 'palm', 'finger', 'fingers'],
      fr: ['main', 'poignet', 'paume', 'doigt', 'doigts'],
    },
  },
  {
    id: 'gluteal',
    region: 'lower_limb',
    label: { ar: 'الأرداف والورك', en: 'Buttock / hip', fr: 'Fessier / hanche' },
    keywords: {
      ar: ['طيزي', 'الارداف', 'الأرداف', 'الورك', 'وركي', 'الحوض', 'حوض', 'الفخذة', 'مقعدي'],
      en: ['buttock', 'glute', 'hip', 'pelvis'],
      fr: ['fessier', 'hanche', 'bassin'],
    },
  },
  {
    id: 'quadriceps',
    region: 'lower_limb',
    label: { ar: 'الفخذ', en: 'Thigh', fr: 'Cuisse' },
    keywords: {
      ar: ['فخذي', 'الفخذ', 'فخدي', 'أفخاذي', 'الرجل من فوق', 'قبل الركبة'],
      en: ['thigh', 'quadriceps', 'quad'],
      fr: ['cuisse', 'quadriceps'],
    },
  },
  {
    id: 'knees',
    region: 'lower_limb',
    label: { ar: 'الركبة', en: 'Knee', fr: 'Genou' },
    keywords: {
      ar: ['ركبتي', 'الركبة', 'ركبتين', 'ركبي', 'مفصل الركبة'],
      en: ['knee', 'knees'],
      fr: ['genou', 'genoux'],
    },
  },
  {
    id: 'calves',
    region: 'lower_limb',
    label: { ar: 'السمانة', en: 'Calf', fr: 'Mollet' },
    keywords: {
      ar: ['سمانتي', 'السمانة', 'بطتي', 'بطة الرجل', 'ساقي', 'الساق', 'عضلة السمانة'],
      en: ['calf', 'calves', 'shin'],
      fr: ['mollet', 'tibia'],
    },
  },
  {
    id: 'ankles',
    region: 'lower_limb',
    label: { ar: 'الكاحل', en: 'Ankle', fr: 'Cheville' },
    keywords: {
      ar: ['كاحلي', 'الكاحل', 'كعب', 'كعبي', 'الكعب'],
      en: ['ankle', 'heel'],
      fr: ['cheville', 'talon'],
    },
  },
  {
    id: 'feet',
    region: 'lower_limb',
    label: { ar: 'القدم', en: 'Foot', fr: 'Pied' },
    keywords: {
      ar: ['قدمي', 'القدم', 'رجلي', 'رجليا', 'أقدامي', 'الرجل', 'رجلين', 'صوابع رجلي', 'مشط القدم'],
      en: ['foot', 'feet', 'toe', 'toes'],
      fr: ['pied', 'orteil', 'orteils'],
    },
  },
];

// ---------------------------------------------------------------------------
// 2) الأعراض المرجعية (مربوطة بأكواد HPO الموجودة في المكتبة الطبية)
// ---------------------------------------------------------------------------
export const SYMPTOM_TERMS: SymptomTerm[] = [
  {
    id: 'hpo:0003326',
    label: { ar: 'ألم عضلي', en: 'Muscle pain', fr: 'Douleur musculaire' },
    redFlag: false,
    keywords: {
      ar: ['ألم عضلي', 'شد عضلي', 'تقل', 'تقلل', 'وجع العضل', 'شد', 'مشدود', 'تمزق عضلي'],
      en: ['muscle pain', 'muscle ache', 'strain', 'spasm'],
      fr: ['douleur musculaire', 'courbature', 'crampe'],
    },
  },
  {
    id: 'hpo:0003418',
    label: { ar: 'ألم الظهر', en: 'Back pain', fr: 'Douleur du dos' },
    redFlag: false,
    keywords: {
      ar: ['ألم الظهر', 'وجع الضهر', 'ألم ضهري', 'الم في الظهر'],
      en: ['back pain', 'backache'],
      fr: ['mal de dos', 'rachialgie'],
    },
  },
  {
    id: 'hpo:0002829',
    label: { ar: 'ألم مفصلي', en: 'Joint pain', fr: 'Douleur articulaire' },
    redFlag: false,
    keywords: {
      ar: ['ألم مفصل', 'وجع المفصل', 'الم في المفصل', 'مفصلي'],
      en: ['joint pain', 'arthralgia'],
      fr: ['douleur articulaire', 'arthralgie'],
    },
  },
  {
    id: 'hpo:0001369',
    label: { ar: 'التهاب مفصلي', en: 'Joint swelling', fr: 'Gonflement articulaire' },
    redFlag: false,
    keywords: {
      ar: ['تورم المفصل', 'انتفاخ المفصل', 'المفصل وارم', 'ورم في المفصل', 'احمرار المفصل'],
      en: ['joint swelling', 'swollen joint', 'arthritis'],
      fr: ['gonflement articulaire', 'articulation gonflée'],
    },
  },
  {
    id: 'hpo:0003401',
    label: { ar: 'تنميل', en: 'Tingling / numbness', fr: 'Fourmillements' },
    redFlag: false,
    keywords: {
      ar: ['تنميل', 'نميل', 'خدر', 'خدري', 'نمل', 'بينمل', 'حاسس بتنميل', 'تنمل'],
      en: ['tingling', 'numbness', 'pins and needles'],
      fr: ['fourmillements', 'engourdissement'],
    },
  },
  {
    id: 'hpo:0002315',
    label: { ar: 'صداع', en: 'Headache', fr: 'Céphalée' },
    redFlag: false,
    keywords: {
      ar: ['صداع', 'صدع', 'وجع في راسي', 'ألم في الرأس'],
      en: ['headache'],
      fr: ['mal de tête', 'céphalée'],
    },
  },
  {
    id: 'hpo:0002076',
    label: { ar: 'شقيقة (صداع نصفي)', en: 'Migraine', fr: 'Migraine' },
    redFlag: false,
    keywords: {
      ar: ['شقيقة', 'صداع نصفي', 'صداع في نص راسي', 'أورا', 'هالة بصرية'],
      en: ['migraine'],
      fr: ['migraine'],
    },
  },
  {
    id: 'hpo:0003408',
    label: { ar: 'خلل الإحساس الجسدي', en: 'Sensory disturbance', fr: 'Trouble sensitif' },
    redFlag: false,
    keywords: {
      ar: ['خلل الإحساس', 'حاسس بحاجة غلط', 'حس غريب', 'فقدان إحساس'],
      en: ['sensory loss', 'altered sensation'],
      fr: ['trouble de la sensibilité'],
    },
  },
  {
    id: 'hpo:0009830',
    label: { ar: 'اعتلال الأعصاب الطرفية', en: 'Peripheral neuropathy', fr: 'Neuropathie périphérique' },
    redFlag: false,
    keywords: {
      ar: ['اعتلال الأعصاب', 'عصب', 'ألم عصبي', 'حرقان في الأطراف', 'ألم يحرق'],
      en: ['neuropathy', 'nerve pain', 'burning pain'],
      fr: ['neuropathie', 'douleur nerveuse'],
    },
  },
  {
    id: 'hpo:0003324',
    label: { ar: 'ضعف عضلي', en: 'Muscle weakness', fr: 'Faiblesse musculaire' },
    redFlag: true,
    keywords: {
      ar: ['ضعف عضلي', 'ضعف', 'مش قادر أشيل', 'رجلي بتخوني', 'عضلاتي ضعيفة'],
      en: ['muscle weakness', 'weakness'],
      fr: ['faiblesse musculaire', 'faiblesse'],
    },
  },
  {
    id: 'hpo:0003552',
    label: { ar: 'توتّر عضلي', en: 'Muscle tension', fr: 'Tension musculaire' },
    redFlag: false,
    keywords: {
      ar: ['توتّر', 'توتر عضلي', 'متوتر', 'مشدود', 'عقدة في العضل'],
      en: ['muscle tension', 'tight muscles'],
      fr: ['tension musculaire', 'muscles tendus'],
    },
  },
  {
    id: 'hpo:0002653',
    label: { ar: 'ألم العظام', en: 'Bone pain', fr: 'Douleur osseuse' },
    redFlag: false,
    keywords: {
      ar: ['ألم العظام', 'وجع العضم', 'عضمي', 'ألم في العظم'],
      en: ['bone pain'],
      fr: ['douleur osseuse'],
    },
  },
  {
    id: 'hpo:0003326b',
    label: { ar: 'ألم عام', en: 'General pain', fr: 'Douleur générale' },
    redFlag: false,
    keywords: {
      ar: ['وجع', 'ألم', 'الم', 'بيوجعني', 'حاسس بألم', 'بتوجعني', 'مؤلم'],
      en: ['pain', 'ache', 'hurts', 'sore'],
      fr: ['douleur', 'mal', 'ça fait mal'],
    },
  },
  {
    id: 'hpo:0012533',
    label: { ar: 'ألم مزمن', en: 'Chronic pain', fr: 'Douleur chronique' },
    redFlag: false,
    keywords: {
      ar: ['ألم مزمن', 'من زمان', 'بقالي شهور', 'مستمر من فترة طويلة'],
      en: ['chronic pain', 'long-standing'],
      fr: ['douleur chronique'],
    },
  },
  {
    id: 'hpo:0002548',
    label: { ar: 'اضطراب المشي', en: 'Gait disturbance', fr: 'Trouble de la marche' },
    redFlag: true,
    keywords: {
      ar: ['مشيتي اتغيرت', 'مش قادر أمشي', 'أعرج', 'عرج', 'مشي متعثر'],
      en: ['gait disturbance', 'can not walk', 'limping'],
      fr: ['trouble de la marche', 'boiter'],
    },
  },
];

// ---------------------------------------------------------------------------
// 3) علامات الإنذار (Red Flags)
// ---------------------------------------------------------------------------
export const RED_FLAG_TERMS: RedFlagTerm[] = [
  {
    id: 'rf:chest_breath',
    level: 'emergency',
    label: { ar: 'ألم صدر مع ضيق نفس', en: 'Chest pain with shortness of breath', fr: 'Douleur thoracique avec essoufflement' },
    keywords: {
      ar: ['ألم في صدري وضيق نفس', 'ضيق نفس', 'ضيق في التنفس', 'مش قادر أتنفس', 'نفسي واقف', 'كتمة', 'ألم صدر مع تعرق', 'ألم صدري وعرق'],
      en: ['shortness of breath', 'can not breathe', 'chest pain and sweating', 'breathless'],
      fr: ['essoufflement', 'difficulté à respirer', 'douleur thoracique et sueurs'],
    },
  },
  {
    id: 'rf:syncope',
    level: 'emergency',
    label: { ar: 'إغماء أو فقدان وعي', en: 'Fainting / loss of consciousness', fr: 'Évanouissement / perte de conscience' },
    keywords: {
      ar: ['إغماء', 'اغماء', 'غبت عن الوعي', 'فقدت الوعي', 'دوخة شديدة وأغمى علي', 'أغمى علي'],
      en: ['fainting', 'passed out', 'loss of consciousness', 'blacked out'],
      fr: ['évanouissement', 'perte de connaissance', 'syncope'],
    },
  },
  {
    id: 'rf:bladder',
    level: 'emergency',
    label: { ar: 'فقدان التحكم في البول أو البراز', en: 'Loss of bladder/bowel control', fr: 'Perte du contrôle vésical/anal' },
    keywords: {
      ar: ['فقدان التحكم في البول', 'مش قادر أتحكم في البول', 'تبول لا إرادي', 'فقدان التحكم في البراز', 'لا إرادي'],
      en: ['loss of bladder control', 'incontinence', 'loss of bowel control'],
      fr: ['incontinence', 'perte du contrôle'],
    },
  },
  {
    id: 'rf:saddle',
    level: 'urgent',
    label: { ar: 'خدر منطقة السَّرج', en: 'Saddle numbness', fr: 'Anesthésie en selle' },
    keywords: {
      ar: ['خدر في منطقة السروج', 'تنميل بين الفخذين', 'خدر تحت', 'تنميل في المقعدة', 'منطقة السروج'],
      en: ['saddle numbness', 'numbness between legs', 'numb groin'],
      fr: ['anesthésie en selle', 'engourdissement périnéal'],
    },
  },
  {
    id: 'rf:progressive_weak',
    level: 'urgent',
    label: { ar: 'ضعف متزايد في الساقين', en: 'Progressive leg weakness', fr: 'Faiblesse progressive des jambes' },
    keywords: {
      ar: ['ضعف متزايد', 'رجلي بتضعف', 'ضعف في الساقين', 'رجلي بتخوني', 'مش قادر أقف'],
      en: ['progressive weakness', 'legs getting weaker', 'can not stand'],
      fr: ['faiblesse progressive', 'jambes qui faiblissent'],
    },
  },
  {
    id: 'rf:fever',
    level: 'urgent',
    label: { ar: 'حرارة مع الألم', en: 'Fever with pain', fr: 'Fièvre avec douleur' },
    keywords: {
      ar: ['حرارة', 'سخونة', 'حمى', 'سخونية', 'جسمي سخن', 'حرارتي عالية', 'قشعريرة'],
      en: ['fever', 'temperature', 'chills', 'high fever'],
      fr: ['fièvre', 'température', 'frissons'],
    },
  },
  {
    id: 'rf:trauma',
    level: 'urgent',
    label: { ar: 'إصابة أو سقوط شديد', en: 'Significant trauma / fall', fr: 'Traumatisme important / chute' },
    keywords: {
      ar: ['وقعت', 'سقطت', 'حادث', 'كسر', 'كسرت', 'إصابة', 'ضربة قوية', 'اتخبطت'],
      en: ['fall', 'accident', 'fracture', 'injury', 'trauma'],
      fr: ['chute', 'accident', 'fracture', 'traumatisme'],
    },
  },
  {
    id: 'rf:vomit_blood',
    level: 'emergency',
    label: { ar: 'قيء دم أو دم في البراز', en: 'Vomiting blood / blood in stool', fr: 'Vomissement de sang / sang dans les selles' },
    keywords: {
      ar: ['قيء دم', 'بترجع دم', 'دم في البراز', 'دم مع البراز', 'نزيف', 'دم في القيء'],
      en: ['vomiting blood', 'blood in stool', 'bleeding'],
      fr: ['vomissement de sang', 'sang dans les selles', 'saignement'],
    },
  },
  {
    id: 'rf:severe_sudden',
    level: 'urgent',
    label: { ar: 'ألم مفاجئ شديد جدًا', en: 'Sudden very severe pain', fr: 'Douleur soudaine très intense' },
    keywords: {
      ar: ['ألم مفاجئ شديد', 'وجع فاجئ شديد', 'ألم رهيب', 'ألم لا يحتمل', 'شديد جداً فجأة', 'ألم قاتل'],
      en: ['sudden severe pain', 'worst pain', 'unbearable pain'],
      fr: ['douleur soudaine intense', 'douleur insupportable'],
    },
  },
  {
    id: 'rf:paralysis',
    level: 'emergency',
    label: { ar: 'شلل أو فقدان حركة', en: 'Paralysis / loss of movement', fr: 'Paralysie / perte de mouvement' },
    keywords: {
      ar: ['شلل', 'مش قادر أحرك', 'فقدت الحركة', 'طرفي مش بيتحرك', 'مفلوج'],
      en: ['paralysis', 'can not move', 'loss of movement'],
      fr: ['paralysie', 'incapable de bouger'],
    },
  },
  {
    id: 'rf:speech_vision',
    level: 'emergency',
    label: { ar: 'تغيّر في الكلام أو الرؤية', en: 'Speech or vision change', fr: 'Trouble de la parole ou de la vision' },
    keywords: {
      ar: ['كلامي متلخبط', 'مش قادر أتكلم', 'رؤيتي ضعفت', 'فقدت النظر', 'شايف مزدوج', 'وشي مايل'],
      en: ['slurred speech', 'can not speak', 'vision loss', 'double vision', 'facial droop'],
      fr: ['parole troublée', 'perte de vision', 'vision double'],
    },
  },
];

// ---------------------------------------------------------------------------
// 4) كلمات الشدّة
// ---------------------------------------------------------------------------
export const SEVERITY_WORDS = {
  mild: {
    ar: ['خفيف', 'بسيط', 'طفييف', 'مش جامد', 'شوية وجع', 'بسيطة'],
    en: ['mild', 'slight', 'minor', 'light'],
    fr: ['léger', 'léger', 'faible', 'léger'],
  } as Record<Lang, string[]>,
  moderate: {
    ar: ['متوسط', 'موسط', 'لا بأس به', 'معقول'],
    en: ['moderate', 'medium'],
    fr: ['modéré', 'moyen'],
  } as Record<Lang, string[]>,
  severe: {
    ar: ['شديد', 'قوي', 'رهيب', 'مؤلم جداً', 'فايت', 'لا يطاق', 'قاسي', 'مزعج جداً'],
    en: ['severe', 'intense', 'strong', 'unbearable', 'terrible'],
    fr: ['sévère', 'intense', 'fort', 'insupportable'],
  } as Record<Lang, string[]>,
};

// ---------------------------------------------------------------------------
// 5) كلمات المدة
// ---------------------------------------------------------------------------
export const DURATION_WORDS = {
  hours: {
    ar: ['ساعة', 'ساعات', 'من ساعة', 'من شوية', 'دلوقتي', 'النهاردة'],
    en: ['hour', 'hours', 'today', 'just now'],
    fr: ['heure', 'heures', "aujourd'hui"],
  } as Record<Lang, string[]>,
  days: {
    ar: ['يوم', 'أيام', 'ايام', 'من يومين', 'من 3 أيام', 'بقاله أيام', 'بقالي أيام'],
    en: ['day', 'days', 'a few days'],
    fr: ['jour', 'jours', 'quelques jours'],
  } as Record<Lang, string[]>,
  weeks: {
    ar: ['أسبوع', 'اسبوع', 'أسابيع', 'اسابيع', 'بقاله أسابيع'],
    en: ['week', 'weeks'],
    fr: ['semaine', 'semaines'],
  } as Record<Lang, string[]>,
  months: {
    ar: ['شهر', 'شهور', 'أشهر', 'اشهر', 'من شهور', 'بقالي شهور'],
    en: ['month', 'months'],
    fr: ['mois'],
  } as Record<Lang, string[]>,
};

// ---------------------------------------------------------------------------
// 6) كلمات النفي (لعكس معنى العرض إن وُجدت قبله)
// ---------------------------------------------------------------------------
export const NEGATION_WORDS: Record<Lang, string[]> = {
  ar: ['مفيش', 'مافيش', 'لا يوجد', 'بدون', 'مش', 'ما', 'ماعنديش', 'بدون'],
  en: ['no', 'not', 'without', 'none', 'never'],
  fr: ['pas', 'sans', 'aucun', 'non'],
};
