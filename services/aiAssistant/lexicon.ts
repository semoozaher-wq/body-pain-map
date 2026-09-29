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

export interface MedicationTerm {
  id: string;
  label: LocalizedText;
  keywords: Record<Lang, string[]>;
  caution: LocalizedText;
}

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
  /**
   * عرض «عام» (مثل كلمة «وجع» أو «ألم» وحدها) لا يجب أن يرفع ترجيح أي مرض
   * عضلي/مفصلي محدّد — يُستخدم فقط لفهم أن المستخدم ذكر ألمًا، دون ترجيح.
   */
  generic?: boolean;
}

/**
 * موضع تشريحي دقيق داخل البطن (ربع/جهة بالنسبة للسرة) — يربط كلام المستخدم
 * مثل «على شمال السرة» بعضو/أعضاء محتملة، حتى لا تُرجَّح أمراض عضلية عامة.
 */
export interface AbdomenLocation {
  id: string;
  label: LocalizedText;
  /** أعضاء مرشّحة لهذا الموضع (مطابقة ids في ORGAN_TERMS). */
  organs: string[];
  /** مناطق الجسم المرتبطة (مطابقة ids في BODY_REGIONS). */
  regions: string[];
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
      ar: ['راسي', 'راسى', 'رأسى', 'الراس', 'الرأس', 'دماغي', 'فروة', 'جبهتي', 'صدغي', 'وجع الراس', 'صداع'],
      en: ['head', 'forehead', 'temple', 'skull'],
      fr: ['tête', 'front', 'tempe', 'crâne'],
    },
  },
  {
    id: 'neck',
    region: 'head_neck',
    label: { ar: 'الرقبة', en: 'Neck', fr: 'Cou' },
    keywords: {
      ar: ['رقبتي', 'رقبتى', 'الرقبة', 'رقبه', 'الرقاب', 'تقل في رقبتي'],
      en: ['neck', 'cervical'],
      fr: ['cou', 'nuque', 'cervical'],
    },
  },
  {
    id: 'upper-back',
    region: 'back',
    label: { ar: 'أعلى الظهر', en: 'Upper back', fr: 'Haut du dos' },
    keywords: {
      ar: ['اعلى ضهري', 'أعلى ضهري', 'اعلى ظهري', 'أعلى ظهري', 'أعلى الظهر', 'بين كتافي', 'بين الكتفين', 'بين لوح الكتف', 'بين لوحي الكتف', 'الظهر العلوي', 'ضهري من فوق', 'ظهري من فوق', 'فوق ضهري', 'فوق ظهري', 'اعلي ضهري', 'اعلي ظهري'],
      en: ['upper back', 'between the shoulders', 'between shoulder blades', 'thoracic'],
      fr: ['haut du dos', 'entre les omoplates', 'thoracique'],
    },
  },
  {
    id: 'mid-back',
    region: 'back',
    label: { ar: 'وسط الظهر', en: 'Mid back', fr: 'Milieu du dos' },
    keywords: {
      ar: ['وسط ضهري', 'وسط ظهري', 'نص ضهري', 'نص ظهري', 'منتصف ضهري', 'منتصف ظهري', 'وسط الظهر', 'نص الظهر', 'منتصف الظهر', 'في نص ضهري', 'في نص ظهري', 'في وسط ضهري', 'في وسط ظهري'],
      en: ['mid back', 'middle back', 'middle of the back'],
      fr: ['milieu du dos', 'centre du dos'],
    },
  },
  {
    id: 'lower-back',
    region: 'back',
    label: { ar: 'أسفل الظهر', en: 'Lower back', fr: 'Bas du dos' },
    keywords: {
      ar: ['اسفل ضهري', 'أسفل الظهر', 'اسفل الظهر', 'قطني', 'القطنية', 'ضهري', 'ظهري', 'ضهرى', 'ظهرى', 'الظهر', 'تحت الخصر', 'الفقرات', 'العمود الفقري', 'عمودي الفقري', 'الحرقفة', 'حقوي'],
      en: ['lower back', 'low back', 'lumbar', 'lumbago'],
      fr: ['bas du dos', 'lombaire', 'lombalgie'],
    },
  },
  {
    id: 'chest',
    region: 'torso_front',
    label: { ar: 'الصدر', en: 'Chest', fr: 'Poitrine' },
    keywords: {
      ar: ['صدري', 'صدرى', 'الصدر', 'قلبي', 'القلب', 'منطقة القلب', 'القص'],
      en: ['chest', 'sternum', 'heart area'],
      fr: ['poitrine', 'thorax', 'sternum', 'cœur'],
    },
  },
  {
    id: 'abs',
    region: 'torso_front',
    label: { ar: 'البطن', en: 'Abdomen', fr: 'Abdomen' },
    keywords: {
      ar: ['بطني', 'بطنى', 'البطن', 'المعدة', 'معدتي', 'المصران', 'القولون', 'الكرش', 'تحت ضلوعي'],
      en: ['abdomen', 'stomach', 'belly', 'tummy', 'gut'],
      fr: ['abdomen', 'ventre', 'estomac'],
    },
  },
  {
    id: 'obliques',
    region: 'torso_front',
    label: { ar: 'الخواصر (الجانب)', en: 'Flank / side', fr: 'Flanc / côté' },
    keywords: {
      // 'جنب' is the bare, non-possessive form of 'جنبي' / 'الجانب'. Without it a
      // message like "في وجع في جنب" matched no region at all and fell through the
      // location-question state, which the loop-breaker criteria require to accept.
      ar: ['جنب', 'جنبي', 'خواصري', 'الخاصرة', 'الجانب', 'على جنب', 'جبي', 'جمبي', 'جنبي', 'على جبي', 'على جمبي', 'جنابي', 'الجنب', 'جنبى', 'الجانب'],
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
      ar: ['ركبتي', 'ركبتى', 'الركبة', 'ركبتين', 'ركبي', 'مفصل الركبة'],
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
    id: 'legs',
    region: 'lower_limb',
    label: { ar: 'الرجل والساق', en: 'Leg', fr: 'Jambe' },
    keywords: {
      ar: ['رجلي', 'رجليا', 'الرجل', 'رجلين', 'الرجلين', 'رجلي من تحت', 'الرجل من تحت'],
      en: ['leg', 'legs'],
      fr: ['jambe', 'jambes'],
    },
  },
  {
    id: 'feet',
    region: 'lower_limb',
    label: { ar: 'القدم', en: 'Foot', fr: 'Pied' },
    keywords: {
      ar: ['قدمي', 'القدم', 'قدم', 'بقدم', 'أقدامي', 'صوابع رجلي', 'مشط القدم', 'القدم الشمال', 'القدم الشماليه', 'القدم اليسرى', 'القدم اليمين', 'القدم اليمنى'],
      en: ['foot', 'feet', 'toe', 'toes'],
      fr: ['pied', 'orteil', 'orteils'],
    },
  },
  {
    id: 'eyes',
    region: 'head_neck',
    label: { ar: 'العين', en: 'Eye', fr: 'Œil' },
    keywords: {
      ar: ['عيني', 'عينيي', 'عينيه', 'العين', 'عينيا', 'عيوني'],
      en: ['eye', 'eyes'],
      fr: ['œil', 'oeil', 'yeux'],
    },
  },
  {
    id: 'ears',
    region: 'head_neck',
    label: { ar: 'الأذن', en: 'Ear', fr: 'Oreille' },
    keywords: {
      ar: ['ودني', 'وداني', 'الأذن', 'الاذن', 'أذني', 'أذني'],
      en: ['ear', 'ears'],
      fr: ['oreille', 'oreilles'],
    },
  },
  {
    id: 'jaw',
    region: 'head_neck',
    label: { ar: 'الفك', en: 'Jaw', fr: 'Mâchoire' },
    keywords: {
      ar: ['فكي', 'الفك', 'فكّي', 'فك', 'المضغ'],
      en: ['jaw', 'jawline'],
      fr: ['mâchoire', 'machoire'],
    },
  },
  {
    id: 'teeth',
    region: 'head_neck',
    label: { ar: 'الأسنان', en: 'Teeth', fr: 'Dents' },
    keywords: {
      ar: ['سني', 'سنيي', 'سناني', 'السن', 'الأسنان', 'الاسنان', 'ضرس', 'ضرسي'],
      en: ['tooth', 'teeth', 'molar'],
      fr: ['dent', 'dents', 'molaire'],
    },
  },
  {
    id: 'mouth',
    region: 'head_neck',
    label: { ar: 'الفم', en: 'Mouth', fr: 'Bouche' },
    keywords: {
      ar: ['فمي', 'فمى', 'الفم', 'بوقي', 'بُقي'],
      en: ['mouth', 'oral'],
      fr: ['bouche', 'oral'],
    },
  },
  {
    id: 'throat',
    region: 'head_neck',
    label: { ar: 'الحلق', en: 'Throat', fr: 'Gorge' },
    keywords: {
      ar: ['حلقي', 'الحلق', 'زورى', 'زوري', 'البلعوم'],
      en: ['throat', 'pharynx'],
      fr: ['gorge', 'pharynx'],
    },
  },
  {
    id: 'breast',
    region: 'torso_front',
    label: { ar: 'الثدي', en: 'Breast', fr: 'Sein' },
    keywords: {
      ar: ['الثدي', 'ثديي', 'ثدي', 'النهود'],
      en: ['breast'],
      fr: ['sein'],
    },
  },
  {
    id: 'groin',
    region: 'lower_limb',
    label: { ar: 'الأربية', en: 'Groin', fr: 'Aine' },
    keywords: {
      ar: ['المغبن', 'الأربية', 'الاريبة', 'أربيتي', 'بين الفخذين', 'منطقة العانة'],
      en: ['groin', 'inguinal', 'pubic area'],
      fr: ['aine', 'inguinal'],
    },
  },
];

// ---------------------------------------------------------------------------
// 1.a) مواضع دقيقة داخل البطن (أرباع/جهات بالنسبة للسرة)
// ---------------------------------------------------------------------------
// تسمح بفهم «على شمال السرة» أو «تحت السرة يمين» وربطها بعضو محتمل،
// بدلًا من إرجاع أمراض عضلية عامة. الترتيب مهم: الأكثر تحديدًا أولًا.
export const ABDOMEN_LOCATIONS: AbdomenLocation[] = [
  {
    id: 'rlq',
    label: { ar: 'أسفل يمين البطن (يمين أسفل السرة)', en: 'Lower-right abdomen (right of the navel)', fr: 'Bas-droit de l’abdomen (à droite du nombril)' },
    organs: ['appendix', 'intestines'],
    regions: ['abs'],
    keywords: {
      ar: [
        'الربع السفلي الايمن', 'الربع السفلى الايمن', 'اسفل البطن يمين', 'اسفل يمين البطن',
        'تحت السره يمين', 'يمين تحت السره', 'يمين اسفل السره', 'علي يمين السره', 'على يمين السره',
        'يمين السره', 'مين السره', 'اسفل البطن علي اليمين', 'اسفل البطن على اليمين',
        'المغبض الايمن',
      ],
      en: ['lower right abdomen', 'right lower abdomen', 'right of the navel', 'right of navel', 'right iliac fossa'],
      fr: ['bas droite de l’abdomen', 'à droite du nombril', 'fosse iliaque droite'],
    },
  },
  {
    id: 'llq',
    label: { ar: 'أسفل يسار البطن (شمال/يسار السرة)', en: 'Lower-left abdomen (left of the navel)', fr: 'Bas-gauche de l’abdomen (à gauche du nombril)' },
    organs: ['intestines', 'ovaries'],
    regions: ['abs'],
    keywords: {
      ar: [
        'الربع السفلي الايسر', 'الربع السفلى الايسر', 'اسفل البطن شمال', 'اسفل شمال البطن',
        'تحت السره شمال', 'شمال تحت السره', 'شمال اسفل السره', 'علي شمال السره', 'على شمال السره',
        'شمال السره', 'يسار السره', 'على يسار السره', 'علي يسار السره', 'اسفل البطن علي الشمال',
        'اسفل البطن على الشمال', 'اسفل البطن يسار', 'المغبض الايسر',
      ],
      en: ['lower left abdomen', 'left lower abdomen', 'left of the navel', 'left of navel', 'left iliac fossa'],
      fr: ['bas gauche de l’abdomen', 'à gauche du nombril', 'fosse iliaque gauche'],
    },
  },
  {
    id: 'ruq',
    label: { ar: 'أعلى يمين البطن (تحت الضلوع يمينًا)', en: 'Upper-right abdomen (below the right ribs)', fr: 'Haut-droit de l’abdomen (sous les côtes droites)' },
    organs: ['liver', 'gallbladder'],
    regions: ['abs'],
    keywords: {
      ar: [
        'الربع العلوي الايمن', 'اعلى البطن يمين', 'فوق السره يمين', 'يمين فوق السره',
        'تحت الضلوع يمين', 'تحت ضلوعي يمين', 'تحت القفص الصدري يمين', 'اعلى يمين البطن',
      ],
      en: ['upper right abdomen', 'right upper abdomen', 'right hypochondrium'],
      fr: ['haut droite de l’abdomen', 'hypochondre droit'],
    },
  },
  {
    id: 'luq',
    label: { ar: 'أعلى يسار البطن (تحت الضلوع يسارًا)', en: 'Upper-left abdomen (below the left ribs)', fr: 'Haut-gauche de l’abdomen (sous les côtes gauches)' },
    organs: ['stomach', 'pancreas'],
    regions: ['abs'],
    keywords: {
      ar: [
        'الربع العلوي الايسر', 'اعلى البطن شمال', 'فوق السره شمال', 'شمال فوق السره',
        'تحت الضلوع شمال', 'تحت ضلوعي شمال', 'تحت القفص الصدري شمال', 'اعلى شمال البطن',
        'فم المعده',
      ],
      en: ['upper left abdomen', 'left upper abdomen', 'left hypochondrium', 'epigastric'],
      fr: ['haut gauche de l’abdomen', 'hypochondre gauche', 'épigastre'],
    },
  },
  {
    id: 'peri-umbilical',
    label: { ar: 'حول السرة (وسط البطن)', en: 'Around the navel (mid-abdomen)', fr: 'Autour du nombril (milieu de l’abdomen)' },
    organs: ['intestines'],
    regions: ['abs'],
    keywords: {
      ar: ['حول السره', 'حوالين السره', 'عند السره', 'عندي في السره', 'وسط البطن', 'في وسط بطني', 'جنب السره', 'على السره'],
      en: ['around the navel', 'around navel', 'peri-umbilical', 'middle of the abdomen', 'mid abdomen'],
      fr: ['autour du nombril', 'péri-ombilical', 'milieu de l’abdomen'],
    },
  },
  {
    id: 'epigastric',
    label: { ar: 'فوق السرة (أعلى البطن)', en: 'Above the navel (upper abdomen)', fr: 'Au-dessus du nombril (haut de l’abdomen)' },
    organs: ['stomach', 'pancreas'],
    regions: ['abs'],
    keywords: {
      ar: ['فوق السره', 'اعلى السره', 'اعلى البطن', 'فوق بطني', 'تحت عضم الصدر', 'فوق المعده'],
      en: ['above the navel', 'above navel', 'upper abdomen', 'epigastrium'],
      fr: ['au-dessus du nombril', 'haut de l’abdomen', 'épigastre'],
    },
  },
  {
    id: 'hypogastric',
    label: { ar: 'تحت السرة (أسفل البطن)', en: 'Below the navel (lower abdomen)', fr: 'Sous le nombril (bas de l’abdomen)' },
    organs: ['bladder', 'uterus', 'intestines'],
    regions: ['abs'],
    keywords: {
      ar: ['تحت السره', 'اسفل السره', 'اسفل البطن', 'تحت بطني', 'فوق العانه', 'منطقه العانه', 'اسفل الحوض'],
      en: ['below the navel', 'below navel', 'lower abdomen', 'suprapubic', 'hypogastric'],
      fr: ['sous le nombril', 'bas de l’abdomen', 'sus-pubien'],
    },
  },
];

// ---------------------------------------------------------------------------
// 1.b) الأعضاء الداخلية (يمكن فتح العضو على خريطة الأعضاء عند توفّر نقطة له)
// ---------------------------------------------------------------------------
/** عضو داخلي مكتشف في كلام المستخدم. */
export interface OrganTerm {
  /** معرّف العضو (مفتاح organDetails.json / organId في anatomyHotspots.json). */
  id: string;
  /** المنطقة التشريحية المرجعية للعضو (تُستخدم لمطابقة الأمراض). */
  region: BodyRegionKey;
  /** هل للعضو نقطة على خريطة الأعضاء (يمكن فتحه مباشرة)؟ */
  onMap: boolean;
  /** الاسم المعروض بثلاث لغات. */
  label: LocalizedText;
  /** وصف موجز لموقع العضو بثلاث لغات. */
  blurb: LocalizedText;
  /** كلمات مفتاحية بكل لغة (فصحى + عامية مصرية). */
  keywords: Record<Lang, string[]>;
}

export const ORGAN_TERMS: OrganTerm[] = [
  {
    id: 'heart',
    region: 'torso_front',
    onMap: true,
    label: { ar: 'القلب', en: 'Heart', fr: 'Cœur' },
    blurb: {
      ar: 'في منتصف الصدر مائلاً قليلاً لليسار، خلف عظمة القص.',
      en: 'In the middle of the chest, slightly to the left, behind the breastbone.',
      fr: 'Au milieu de la poitrine, légèrement à gauche, derrière le sternum.',
    },
    keywords: {
      ar: ['قلبي', 'القلب', 'قلب', 'منطقة القلب', 'عضلة القلب'],
      en: ['heart', 'cardiac'],
      fr: ['cœur', 'coeur', 'cardiaque'],
    },
  },
  {
    id: 'lungs',
    region: 'torso_front',
    onMap: true,
    label: { ar: 'الرئتان', en: 'Lungs', fr: 'Poumons' },
    blurb: {
      ar: 'في الصدر على جانبي القلب، محمية بالقفص الصدري.',
      en: 'In the chest on both sides of the heart, protected by the rib cage.',
      fr: 'Dans la poitrine de part et d’autre du cœur, protégés par la cage thoracique.',
    },
    keywords: {
      ar: ['رئتي', 'الرئة', 'الرئتين', 'رئة', 'الرئات', 'الرئه'],
      en: ['lung', 'lungs', 'pulmonary'],
      fr: ['poumon', 'poumons', 'pulmonaire'],
    },
  },
  {
    id: 'esophagus',
    region: 'torso_front',
    onMap: false,
    label: { ar: 'المريء', en: 'Esophagus', fr: 'Œsophage' },
    blurb: {
      ar: 'أنبوب عضلي يصل الحلق بالمعدة، خلف القص.',
      en: 'A muscular tube connecting the throat to the stomach, behind the breastbone.',
      fr: 'Tube musculaire reliant la gorge à l’estomac, derrière le sternum.',
    },
    keywords: {
      ar: ['المريء', 'مريئي', 'البلعوم'],
      en: ['esophagus', 'oesophagus', 'gullet'],
      fr: ['œsophage', 'oesophage'],
    },
  },
  {
    id: 'stomach',
    region: 'torso_front',
    onMap: true,
    label: { ar: 'المعدة', en: 'Stomach', fr: 'Estomac' },
    blurb: {
      ar: 'في أعلى البطن يسارًا، تحت القفص الصدري.',
      en: 'Upper-left abdomen, below the rib cage.',
      fr: 'Partie supérieure gauche de l’abdomen, sous les côtes.',
    },
    keywords: {
      ar: ['معدتي', 'المعدة', 'معدة', 'فم المعدة', 'جدار المعدة'],
      en: ['stomach', 'gastric'],
      fr: ['estomac', 'gastrique'],
    },
  },
  {
    id: 'liver',
    region: 'torso_front',
    onMap: true,
    label: { ar: 'الكبد', en: 'Liver', fr: 'Foie' },
    blurb: {
      ar: 'في أعلى البطن يمينًا، تحت القفص الصدري.',
      en: 'Upper-right abdomen, under the rib cage.',
      fr: 'Partie supérieure droite de l’abdomen, sous les côtes.',
    },
    keywords: {
      ar: ['كبدي', 'الكبد', 'كبد'],
      en: ['liver', 'hepatic'],
      fr: ['foie', 'hépatique', 'hepatique'],
    },
  },
  {
    id: 'gallbladder',
    region: 'torso_front',
    onMap: false,
    label: { ar: 'المرارة', en: 'Gallbladder', fr: 'Vésicule biliaire' },
    blurb: {
      ar: 'تحت الكبد في أعلى البطن يمينًا.',
      en: 'Under the liver in the upper-right abdomen.',
      fr: 'Sous le foie, en haut à droite de l’abdomen.',
    },
    keywords: {
      ar: ['المرارة', 'مرارتي', 'الحوصلة الصفراوية', 'حصوة مرارية'],
      en: ['gallbladder', 'gall bladder', 'biliary'],
      fr: ['vésicule biliaire', 'vesicule biliaire', 'biliaire'],
    },
  },
  {
    id: 'pancreas',
    region: 'torso_front',
    onMap: false,
    label: { ar: 'البنكرياس', en: 'Pancreas', fr: 'Pancréas' },
    blurb: {
      ar: 'خلف المعدة في أعلى البطن، قريبًا من العمود الفقري.',
      en: 'Behind the stomach in the upper abdomen, near the spine.',
      fr: 'Derrière l’estomac, en haut de l’abdomen, près de la colonne.',
    },
    keywords: {
      ar: ['البنكرياس', 'بنكرياسي'],
      en: ['pancreas', 'pancreatic'],
      fr: ['pancréas', 'pancreas', 'pancreatique'],
    },
  },
  {
    id: 'kidneys',
    region: 'back',
    onMap: true,
    label: { ar: 'الكلى', en: 'Kidneys', fr: 'Reins' },
    blurb: {
      ar: 'في أعلى الظهر على جانبي العمود الفقري، خلف البطن.',
      en: 'Upper back on both sides of the spine, behind the abdomen.',
      fr: 'Haut du dos de part et d’autre de la colonne, derrière l’abdomen.',
    },
    keywords: {
      ar: ['كليتي', 'الكلى', 'الكلية', 'كلى', 'كليتين', 'الكليتين', 'حصوة كلوية', 'مغص كلوي'],
      en: ['kidney', 'kidneys', 'renal'],
      fr: ['rein', 'reins', 'rénal', 'renal'],
    },
  },
  {
    id: 'intestines',
    region: 'torso_front',
    onMap: false,
    label: { ar: 'الأمعاء', en: 'Intestines', fr: 'Intestins' },
    blurb: {
      ar: 'في وسط وأسفل البطن، حول السرة.',
      en: 'Middle and lower abdomen, around the navel.',
      fr: 'Milieu et bas de l’abdomen, autour du nombril.',
    },
    keywords: {
      ar: ['الأمعاء', 'امعائي', 'أمعائي', 'المصران', 'القولون', 'الأمعاء الدقيقة', 'الأمعاء الغليظة'],
      en: ['intestine', 'intestines', 'bowel', 'colon', 'gut'],
      fr: ['intestin', 'intestins', 'côlon', 'colon', 'boyau'],
    },
  },
  {
    id: 'appendix',
    region: 'torso_front',
    onMap: false,
    label: { ar: 'الزائدة الدودية', en: 'Appendix', fr: 'Appendice' },
    blurb: {
      ar: 'في أسفل البطن يمينًا، حيث يبدأ القولون.',
      en: 'Lower-right abdomen, where the colon begins.',
      fr: 'Bas droit de l’abdomen, au début du côlon.',
    },
    keywords: {
      ar: ['الزائدة الدودية', 'الزائدة', 'زائدتي', 'زائدة دودية'],
      en: ['appendix', 'appendicitis'],
      fr: ['appendice', 'appendicite'],
    },
  },
  {
    id: 'bladder',
    region: 'lower_limb',
    onMap: false,
    label: { ar: 'المثانة', en: 'Bladder', fr: 'Vessie' },
    blurb: {
      ar: 'في أسفل الحوض، خلف عظمة العانة.',
      en: 'Lower pelvis, behind the pubic bone.',
      fr: 'Bas du bassin, derrière l’os pubien.',
    },
    keywords: {
      ar: ['المثانة', 'مثانتي', 'التهاب المثانة'],
      en: ['bladder', 'urinary'],
      fr: ['vessie', 'urinaire'],
    },
  },
  {
    id: 'uterus',
    region: 'lower_limb',
    onMap: true,
    label: { ar: 'الرحم', en: 'Uterus', fr: 'Utérus' },
    blurb: {
      ar: 'في وسط الحوض (للنساء).',
      en: 'In the centre of the pelvis (female).',
      fr: 'Au centre du bassin (femme).',
    },
    keywords: {
      ar: ['الرحم', 'رحمي', 'عنق الرحم'],
      en: ['uterus', 'womb', 'uterine'],
      fr: ['utérus', 'uterus', 'utérin'],
    },
  },
  {
    id: 'ovaries',
    region: 'lower_limb',
    onMap: true,
    label: { ar: 'المبيضان', en: 'Ovaries', fr: 'Ovaires' },
    blurb: {
      ar: 'على جانبي الرحم في الحوض (للنساء).',
      en: 'On both sides of the uterus in the pelvis (female).',
      fr: 'De part et d’autre de l’utérus (femme).',
    },
    keywords: {
      ar: ['المبيض', 'المبيضان', 'مبيضي', 'المبيضين', 'كيس على المبيض'],
      en: ['ovary', 'ovaries', 'ovarian'],
      fr: ['ovaire', 'ovaires', 'ovarien'],
    },
  },
  {
    id: 'prostate',
    region: 'lower_limb',
    onMap: false,
    label: { ar: 'البروستاتا', en: 'Prostate', fr: 'Prostate' },
    blurb: {
      ar: 'أسفل المثانة في الحوض (للرجال).',
      en: 'Below the bladder in the pelvis (male).',
      fr: 'Sous la vessie, dans le bassin (homme).',
    },
    keywords: {
      ar: ['البروستاتا', 'البروستات', 'بروستاتتي', 'تضخم البروستاتا'],
      en: ['prostate'],
      fr: ['prostate'],
    },
  },
  {
    id: 'testicles',
    region: 'lower_limb',
    onMap: false,
    label: { ar: 'الخصيتان', en: 'Testicles', fr: 'Testicules' },
    blurb: {
      ar: 'داخل كيس الصفن أسفل الحوض (للرجال).',
      en: 'Inside the scrotum below the pelvis (male anatomy).',
      fr: 'Dans le scrotum sous le bassin (anatomie masculine).',
    },
    keywords: {
      ar: ['الخصية', 'الخصيتين', 'الخصيتان', 'خصيتي', 'خصيتي اليمين', 'خصيتي الشمال', 'خصية اليمين', 'خصية الشمال', 'كيس الصفن', 'الصفن'],
      en: ['testicle', 'testicles', 'testis', 'scrotum'],
      fr: ['testicule', 'testicules', 'scrotum'],
    },
  },
  {
    id: 'thyroid',
    region: 'head_neck',
    onMap: true,
    label: { ar: 'الغدة الدرقية', en: 'Thyroid', fr: 'Thyroïde' },
    blurb: {
      ar: 'في مقدمة الرقبة، أسفل تفاحة آدم.',
      en: 'Front of the neck, below the Adam’s apple.',
      fr: 'Avant du cou, sous la pomme d’Adam.',
    },
    keywords: {
      ar: ['الغدة الدرقية', 'الدرقية', 'الغده الدرقيه', 'الغدة الدرقيه'],
      en: ['thyroid'],
      fr: ['thyroïde', 'thyroide'],
    },
  },
  {
    id: 'tonsils',
    region: 'head_neck',
    onMap: false,
    label: { ar: 'اللوزتان', en: 'Tonsils', fr: 'Amygdales' },
    blurb: {
      ar: 'في مؤخرة الحلق على الجانبين.',
      en: 'At the back of the throat on both sides.',
      fr: 'À l’arrière de la gorge, sur les côtés.',
    },
    keywords: {
      ar: ['اللوزتان', 'اللوزتين', 'اللوزة', 'لوزتي', 'التهاب اللوزتين'],
      en: ['tonsil', 'tonsils'],
      fr: ['amygdale', 'amygdales'],
    },
  },
  {
    id: 'lymph-nodes',
    region: 'head_neck',
    onMap: false,
    label: { ar: 'الغدد الليمفاوية', en: 'Lymph nodes', fr: 'Ganglions lymphatiques' },
    blurb: {
      ar: 'منتشرة في الرقبة والإبطين وأعلى الفخذ.',
      en: 'Scattered in the neck, armpits, and groin.',
      fr: 'Répartis dans le cou, les aisselles et l’aine.',
    },
    keywords: {
      ar: ['الغدد الليمفاوية', 'الغدد اللمفاوية', 'العقد الليمفاوية', 'غدة لمفاوية', 'غدد لمفاوية'],
      en: ['lymph node', 'lymph nodes', 'lymphatic'],
      fr: ['ganglion lymphatique', 'ganglions', 'lymphatique'],
    },
  },
  {
    id: 'salivary-glands',
    region: 'head_neck',
    onMap: false,
    label: { ar: 'الغدد اللعابية', en: 'Salivary glands', fr: 'Glandes salivaires' },
    blurb: {
      ar: 'حول الفم والخدين وتحت الفك.',
      en: 'Around the mouth, cheeks, and under the jaw.',
      fr: 'Autour de la bouche, des joues et sous la mâchoire.',
    },
    keywords: {
      ar: ['الغدد اللعابية', 'الغدة اللعابية', 'اللعابية', 'غدة لعابية'],
      en: ['salivary gland', 'salivary glands'],
      fr: ['glande salivaire', 'glandes salivaires'],
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
      ar: ['تنميل', 'نميل', 'خدر', 'خدري', 'نمل', 'بينمل', 'حاسس بتنميل', 'تنمل', 'وخز', 'نمش', 'نمّل', 'بتنم', 'حس نمش'],
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
    id: 'sym:general-pain',
    label: { ar: 'ألم عام', en: 'General pain', fr: 'Douleur générale' },
    redFlag: false,
    generic: true,
    keywords: {
      ar: ['وجع', 'ألم', 'الم', 'بيوجعني', 'بتوجعني', 'بتحرق', 'بتلسع', 'بتنخ', 'بتقرص', 'حاسس بوجع', 'عندي وجع', 'عندي ألم', 'حاسس بألم', 'مؤلم', 'أوجاع', 'اوجاع'],
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
    id: 'hpo:0002014',
    label: { ar: 'إسهال', en: 'Diarrhoea', fr: 'Diarrhée' },
    redFlag: false,
    keywords: {
      ar: ['إسهال', 'اسهال', 'بطنى بتطلع', 'البطن بيطلع', 'بطن سايبة', 'بطنى سايبة'],
      en: ['diarrhoea', 'diarrhea', 'loose stool'],
      fr: ['diarrhée'],
    },
  },
  {
    id: 'hpo:0002017',
    label: { ar: 'غثيان وقيء', en: 'Nausea / vomiting', fr: 'Nausées / vomissements' },
    redFlag: false,
    keywords: {
      ar: ['غثيان', 'قيء', 'استفراغ', 'بستفرغ', 'حاسس بغثيان', 'رغبة في القيء'],
      en: ['nausea', 'vomiting', 'throwing up'],
      fr: ['nausée', 'vomissement'],
    },
  },
  {
    id: 'hpo:0002020',
    label: { ar: 'حرقان المعدة (ارتجاع)', en: 'Heartburn / reflux', fr: 'Brûlures / reflux' },
    redFlag: false,
    keywords: {
      ar: ['حرقان في المعدة', 'حرقان', 'حموضة', 'ارتجاع', 'بيطلع أكل', 'طعم مر في بقي'],
      en: ['heartburn', 'reflux', 'acid'],
      fr: ['brûlures', 'reflux', 'acidité'],
    },
  },
  {
    id: 'hpo:0001945',
    label: { ar: 'حمّى', en: 'Fever', fr: 'Fièvre' },
    redFlag: false,
    keywords: {
      ar: ['حمى', 'حرارة', 'سخونة', 'حرارتي عالية', 'حرارة الجسم'],
      en: ['fever', 'temperature'],
      fr: ['fièvre'],
    },
  },
  {
    id: 'hpo:0012378',
    label: { ar: 'إجهاد', en: 'Fatigue', fr: 'Fatigue' },
    redFlag: false,
    keywords: {
      ar: ['إجهاد', 'اجهاد', 'تعبان', 'تعب', 'إرهاق', 'ارهاق', 'ماليش طاقة'],
      en: ['fatigue', 'tired', 'exhausted'],
      fr: ['fatigue', 'épuisé'],
    },
  },
  {
    id: 'hpo:0002360',
    label: { ar: 'اضطراب النوم', en: 'Sleep disturbance', fr: 'Trouble du sommeil' },
    redFlag: false,
    keywords: {
      ar: ['اضطراب النوم', 'مش بنام', 'قلة النوم', 'نومي متقطع', 'مش نايم كويس'],
      en: ['sleep disturbance', 'cannot sleep', 'poor sleep'],
      fr: ['trouble du sommeil', 'insomnie'],
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
    id: 'rf:testicular_torsion',
    level: 'emergency',
    label: { ar: 'ألم مفاجئ أو تورّم شديد في الخصية', en: 'Sudden severe testicular pain or swelling', fr: 'Douleur ou gonflement testiculaire soudain et intense' },
    keywords: {
      ar: ['الم مفاجئ في الخصية', 'ألم مفاجئ في الخصية', 'ألم مفاجئ شديد في الخصية', 'ألم شديد مفاجئ في الخصية', 'وجع مفاجئ في الخصية', 'الخصية متورمة', 'الخصية وارمة', 'تورم الخصية', 'مع تورم في الخصية', 'الخصية طالعة لفوق', 'قيء مع ألم الخصية', 'خصية متورمة فجأة'],
      en: ['sudden testicle pain', 'sudden testicular pain', 'swollen testicle', 'testicle swelling', 'testicle pulled up', 'vomiting with testicle pain'],
      fr: ['douleur testiculaire soudaine', 'testicule gonflé', 'torsion testiculaire'],
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
// 3.5) نوع العرض + التوقيت + السياق
// ---------------------------------------------------------------------------
export interface LexiconBucket {
  label: LocalizedText;
  keywords: Record<Lang, string[]>;
}

export const SYMPTOM_TYPES: Record<string, LexiconBucket> = {
  tingling: { label: { ar: 'وخز / تنميل', en: 'Tingling / numbness', fr: 'Fourmillements / engourdissement' }, keywords: { ar: ['وخز', 'تنميل', 'نمش', 'نمّل', 'بتنم', 'حس نمش'], en: ['pins and needles', 'tingling', 'numbness'], fr: ['fourmillements', 'picotements', 'engourdissement'] } },
  stabbing: { label: { ar: 'نغزة', en: 'Stabbing pain', fr: 'Douleur lancinante' }, keywords: { ar: ['نغزة', 'نغز', 'طعن', 'زي السكينة'], en: ['stab', 'stabbing', 'sharp pain'], fr: ['piqûre', 'lancinante', 'douleur vive'] } },
  burning: { label: { ar: 'حرقان', en: 'Burning', fr: 'Brûlure' }, keywords: { ar: ['حرقان', 'بيحرق', 'حرق', 'لاسع'], en: ['burning', 'burn'], fr: ['brûlure', 'brûlant'] } },
  tightness: { label: { ar: 'شد', en: 'Tightness / spasm', fr: 'Tension / spasme' }, keywords: { ar: ['شد', 'تشنج', 'مشدود', 'متشنج'], en: ['tightness', 'spasm', 'cramp'], fr: ['tension', 'spasme', 'crampe'] } },
  throbbing: { label: { ar: 'نبض', en: 'Throbbing', fr: 'Pulsatile' }, keywords: { ar: ['نبض', 'بينبض', 'زي النبض'], en: ['throbbing', 'pulsating'], fr: ['pulsatile', 'battement'] } },
  electric: { label: { ar: 'كهربا', en: 'Electric shock', fr: 'Décharge électrique' }, keywords: { ar: ['كهربا', 'صعقة', 'زي الكهربا'], en: ['electric', 'shock'], fr: ['électrique', 'décharge'] } },
  heaviness: { label: { ar: 'ثقل', en: 'Heaviness', fr: 'Lourdeur' }, keywords: { ar: ['ثقل', 'تقل', 'تقيل', 'وزن'], en: ['heaviness', 'heavy'], fr: ['lourdeur', 'lourd'] } },
  pressure: { label: { ar: 'ضغط', en: 'Pressure', fr: 'Pression' }, keywords: { ar: ['ضغط', 'ضاغط', 'معصور'], en: ['pressure', 'squeezing'], fr: ['pression', 'compression'] } },
  dryness: { label: { ar: 'نشفان', en: 'Dryness', fr: 'Sécheresse' }, keywords: { ar: ['نشفان', 'جفاف', 'ناشف'], en: ['dryness', 'dry'], fr: ['sécheresse', 'sec'] } },
};

export const TIMINGS: Record<string, LexiconBucket> = {
  sleep: { label: { ar: 'وقت النوم', en: 'At night / during sleep', fr: 'La nuit / pendant le sommeil' }, keywords: { ar: ['وقت النوم', 'أثناء النوم', 'بالليل', 'ليلي'], en: ['at night', 'during sleep', 'nocturnal'], fr: ['la nuit', 'pendant le sommeil', 'nocturne'] } },
  morning: { label: { ar: 'الصبح', en: 'Morning', fr: 'Matin' }, keywords: { ar: ['الصبح', 'الفجر', 'عند الاستيقاظ'], en: ['morning', 'on waking'], fr: ['matin', 'au réveil'] } },
  late_night: { label: { ar: 'آخر الليل', en: 'Late night', fr: 'Tard dans la nuit' }, keywords: { ar: ['آخر الليل', 'بعد نص الليل'], en: ['late night'], fr: ['tard dans la nuit'] } },
  after_eating: { label: { ar: 'بعد الأكل', en: 'After eating', fr: 'Après avoir mangé' }, keywords: { ar: ['بعد الأكل', 'عند الأكل', 'بعد الوجبة'], en: ['after eating', 'postprandial'], fr: ['après avoir mangé', 'postprandial'] } },
  movement: { label: { ar: 'مع الحركة', en: 'With movement', fr: 'Avec le mouvement' }, keywords: { ar: ['مع الحركة', 'لما أتحرك'], en: ['on movement', 'with movement'], fr: ['avec le mouvement'] } },
  rest: { label: { ar: 'وقت الراحة', en: 'At rest', fr: 'Au repos' }, keywords: { ar: ['وقت الراحة', 'وأنا قاعد'], en: ['at rest', 'resting'], fr: ['au repos'] } },
  constant: { label: { ar: 'مستمر', en: 'Constant', fr: 'Constant' }, keywords: { ar: ['مستمر', 'دايمًا', 'طول الوقت'], en: ['constant', 'continuous'], fr: ['constant', 'continu'] } },
  intermittent: { label: { ar: 'متقطع', en: 'Intermittent', fr: 'Intermittent' }, keywords: { ar: ['متقطع', 'يجي ويروح'], en: ['intermittent', 'comes and goes'], fr: ['intermittent', 'va et vient'] } },
};

export const CONTEXTS: Record<string, LexiconBucket> = {
  exercise: { label: { ar: 'بعد الرياضة', en: 'After exercise', fr: 'Après le sport' }, keywords: { ar: ['بعد الرياضة', 'بعد الجيم', 'بعد التمرين'], en: ['after exercise', 'post workout'], fr: ['après le sport', 'après l’exercice'] } },
  stress: { label: { ar: 'مع التوتر', en: 'With stress', fr: 'Avec le stress' }, keywords: { ar: ['مع التوتر', 'مع القلق', 'مع العصبية'], en: ['with stress', 'anxiety'], fr: ['avec le stress', 'anxiété'] } },
  prolonged_sitting: { label: { ar: 'بعد الجلوس الطويل', en: 'After prolonged sitting', fr: 'Après une position assise prolongée' }, keywords: { ar: ['بعد الجلوس الطويل', 'بعد القاعدة'], en: ['prolonged sitting'], fr: ['position assise prolongée'] } },
  cold: { label: { ar: 'مع البرد', en: 'With cold', fr: 'Avec le froid' }, keywords: { ar: ['مع البرد', 'في الشتا'], en: ['with cold'], fr: ['avec le froid'] } },
  heat: { label: { ar: 'مع الحرارة', en: 'With heat', fr: 'Avec la chaleur' }, keywords: { ar: ['مع الحرارة', 'في الصيف'], en: ['with heat'], fr: ['avec la chaleur'] } },
};

/**
 * Exact symptom + location rules. Values are IDs from the existing medical
 * library, so the assistant never invents a condition that the app cannot
 * render or source.
 */
export const SYMPTOM_CONDITIONS: Record<string, Record<string, string[]>> = {
  tingling: {
    _all: ['doid:9350', 'doid:13241', 'doid:10202'],
    neck: ['doid:10202', 'doid:9350', 'doid:6713'],
    hands: ['doid:13241', 'doid:9350'],
    abs: ['doid:9350', 'doid:8505'],
    back: ['doid:10202-ls', 'doid:9350', 'doid:6713'],
    feet: ['doid:9350', 'doid:6713'],
    legs: ['doid:9350', 'local:deep-vein-thrombosis', 'doid:10202-ls'],
    chest: ['doid:12353', 'doid:angina', 'doid:9350'],
  },
  burning: {
    _all: ['doid:9350', 'doid:shingles', 'doid:12353'],
    neck: ['doid:shingles', 'doid:10202', 'doid:9350'],
    hands: ['doid:13241', 'doid:9350', 'local:diabetic-neuropathy'],
    feet: ['doid:9350', 'doid:12353'],
    eyes: ['local:dry-eye-syndrome', 'local:sjogren-syndrome'],
    abs: ['doid:12353', 'doid:gastritis', 'doid:peptic-ulcer'],
    chest: ['doid:12353', 'doid:angina', 'doid:pericarditis'],
    urinary: ['doid:uti', 'doid:kidney-stone'],
  },
  tightness: {
    _all: ['doid:6713', 'doid:11476-th'],
    neck: ['doid:6713', 'doid:10202', 'doid:9350'],
    chest: ['doid:angina', 'doid:12353', 'doid:6713'],
    back: ['doid:6713', 'doid:8505', 'doid:10202-ls'],
    abs: ['doid:6713', 'doid:ibs', 'doid:gastritis'],
  },
  stabbing: {
    _all: ['doid:6713', 'doid:10202', 'doid:9350'],
    neck: ['doid:10202', 'doid:6713', 'doid:9350'],
    head: ['doid:3311', 'doid:cluster-headache', 'doid:11476-th'],
    chest: ['doid:angina', 'doid:pericarditis', 'doid:12353'],
    abs: ['doid:gastritis', 'doid:peptic-ulcer', 'doid:6713'],
    back: ['doid:10202-ls', 'doid:6713', 'doid:9350'],
    feet: ['doid:9350', 'doid:6713', 'doid:13241'],
  },
  throbbing: {
    _all: ['doid:3311', 'doid:cluster-headache', 'doid:10763'],
    head: ['doid:3311', 'doid:cluster-headache', 'doid:10763'],
    neck: ['doid:3311', 'doid:11476-th', 'doid:10763'],
    chest: ['doid:angina', 'doid:pericarditis'],
    abs: ['local:aortic-aneurysm', 'doid:pancreatitis', 'doid:6713'],
  },
  electric: {
    _all: ['doid:9350', 'doid:10202-ls', 'doid:10202'],
    back: ['doid:10202-ls', 'doid:9350', 'doid:6713'],
    hands: ['doid:9350', 'doid:13241'],
    feet: ['doid:9350', 'doid:6713'],
    neck: ['doid:10202', 'doid:9350', 'doid:6713'],
  },
  heaviness: {
    _all: ['doid:10763', 'doid:1490', 'doid:9350'],
    legs: ['local:edema', 'local:deep-vein-thrombosis', 'doid:varicose-veins'],
    chest: ['doid:angina', 'doid:pericarditis'],
    head: ['doid:10763', 'doid:11476-th'],
  },
  pressure: {
    _all: ['doid:11476-th', 'doid:10763'],
    chest: ['doid:angina', 'local:myocardial-infarction', 'doid:pericarditis'],
    head: ['doid:11476-th', 'doid:10763'],
    eyes: ['local:glaucoma'],
  },
  dryness: {
    _all: ['local:dry-eye-syndrome', 'local:sjogren-syndrome'],
    eyes: ['local:dry-eye-syndrome', 'local:sjogren-syndrome'],
    mouth: ['local:type-2-diabetes', 'local:sjogren-syndrome'],
    throat: ['doid:12353', 'local:sjogren-syndrome', 'local:allergic-rhinitis'],
  },
};

export const SYMPTOM_TIMING_BOOSTS: Record<string, Record<string, string[]>> = {
  tingling: {
    sleep: ['doid:10202', 'doid:13241', 'doid:9350'],
    morning: ['doid:8483', 'doid:9350'],
    rest: ['doid:9350', 'doid:10202'],
  },
  throbbing: {
    sleep: ['doid:3311', 'doid:cluster-headache'],
    stress: ['doid:3311', 'doid:11476-th'],
    morning: ['doid:10763', 'doid:3311'],
  },
  burning: {
    sleep: ['doid:9350', 'doid:shingles'],
    rest: ['doid:9350', 'doid:12353'],
    after_eating: ['doid:12353', 'doid:gastritis', 'doid:peptic-ulcer'],
  },
  tightness: {
    sleep: ['doid:10202', 'doid:6713'],
    morning: ['doid:8483', 'doid:6713'],
    rest: ['doid:6713', 'doid:8505'],
  },
  pressure: {
    stress: ['doid:11476-th', 'doid:angina'],
    sleep: ['doid:angina', 'doid:10763'],
  },
  heaviness: {
    rest: ['local:deep-vein-thrombosis', 'local:edema', 'doid:varicose-veins'],
    prolonged_sitting: ['local:deep-vein-thrombosis', 'local:edema'],
  },
  dryness: {
    sleep: ['local:dry-eye-syndrome', 'local:sjogren-syndrome'],
    morning: ['local:dry-eye-syndrome', 'local:sjogren-syndrome'],
  },
};

export const CONTEXT_CONDITION_BOOSTS: Record<string, string[]> = {
  exercise: ['doid:6713', 'doid:8505-doms', 'doid:10202-ls'],
  stress: ['doid:11476-th', 'doid:6713', 'doid:3311'],
  prolonged_sitting: ['doid:10202', 'doid:6713', 'doid:10202-ls'],
  cold: ['doid:8483', 'local:raynaud', 'doid:6713'],
  heat: ['doid:3311', 'local:dehydration', 'local:heat-exhaustion'],
};

// ---------------------------------------------------------------------------
// 4) كلمات الشدّة
// ---------------------------------------------------------------------------
export const SEVERITY_WORDS = {
  mild: {
    ar: ['خفيف', 'بسيط', 'طفييف', 'مش جامد', 'شوية وجع', 'بسيطة', 'بيضايق شوية', 'خفيف خالص'],
    en: ['mild', 'slight', 'minor', 'light'],
    fr: ['léger', 'léger', 'faible', 'léger'],
  } as Record<Lang, string[]>,
  moderate: {
    ar: ['متوسط', 'موسط', 'لا بأس به', 'معقول', 'بيضايقني', 'بيزعجني'],
    en: ['moderate', 'medium'],
    fr: ['modéré', 'moyen'],
  } as Record<Lang, string[]>,
  severe: {
    ar: ['شديد', 'قوي', 'رهيب', 'مؤلم جداً', 'فايت', 'لا يطاق', 'قاسي', 'مزعج جداً', 'مش قادر أتحرك', 'مفش قادر أقعد', 'وجع بيقطع'],
    en: ['severe', 'intense', 'strong', 'unbearable', 'terrible'],
    fr: ['sévère', 'intense', 'fort', 'insupportable'],
  } as Record<Lang, string[]>,
};

// ---------------------------------------------------------------------------
// 5) كلمات المدة
// ---------------------------------------------------------------------------
export const DURATION_WORDS = {
  hours: {
    ar: ['ساعة', 'ساعات', 'من ساعة', 'من شوية', 'دلوقتي', 'النهاردة', 'من الصبح', 'من ساعتين'],
    en: ['hour', 'hours', 'today', 'just now'],
    fr: ['heure', 'heures', "aujourd'hui"],
  } as Record<Lang, string[]>,
  days: {
    ar: ['يوم', 'أيام', 'ايام', 'من امبارح', 'من يومين', 'من 3 أيام', 'بقاله أيام', 'بقالي أيام', 'بقاله كام يوم'],
    en: ['day', 'days', 'a few days'],
    fr: ['jour', 'jours', 'quelques jours'],
  } as Record<Lang, string[]>,
  weeks: {
    ar: ['أسبوع', 'اسبوع', 'أسابيع', 'اسابيع', 'من أسبوع', 'بقاله أسبوعين', 'بقاله أسابيع'],
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

// ---------------------------------------------------------------------------
// 7) المواضع الدقيقة داخل كل منطقة (للسؤال التوضيحي)
// ---------------------------------------------------------------------------
export interface RegionLocation {
  id: string;
  parent: string;
  label: LocalizedText;
  keywords: Record<Lang, string[]>;
}

export const REGION_LOCATIONS: RegionLocation[] = [
  // الرأس
  { id: 'head-front', parent: 'head', label: { ar: 'مقدمة الرأس', en: 'Front of head', fr: 'Avant de la tête' }, keywords: { ar: ['مقدمه راسي','جبهتي'], en: ['front of head','forehead'], fr: ['avant de la tête'] } },
  { id: 'head-back', parent: 'head', label: { ar: 'مؤخرة الرأس', en: 'Back of head', fr: 'Arrière de la tête' }, keywords: { ar: ['مؤخره راسي','قفايا'], en: ['back of head'], fr: ['arrière de la tête'] } },
  { id: 'head-right', parent: 'head', label: { ar: 'يمين الرأس', en: 'Right side of head', fr: 'Côté droit de la tête' }, keywords: { ar: ['يمين راسي'], en: ['right side of head'], fr: ['côté droit'] } },
  { id: 'head-left', parent: 'head', label: { ar: 'شمال الرأس', en: 'Left side of head', fr: 'Côté gauche de la tête' }, keywords: { ar: ['شمال راسي'], en: ['left side of head'], fr: ['côté gauche'] } },
  { id: 'head-top', parent: 'head', label: { ar: 'أعلى الرأس', en: 'Top of head', fr: 'Sommet de la tête' }, keywords: { ar: ['قمة راسي','فوق راسي'], en: ['top of head'], fr: ['sommet'] } },

  // الرقبة
  { id: 'neck-front', parent: 'neck', label: { ar: 'مقدمة الرقبة', en: 'Front of neck', fr: 'Avant du cou' }, keywords: { ar: ['مقدمه رقبتي','زوري'], en: ['front of neck'], fr: ['avant du cou'] } },
  { id: 'neck-back', parent: 'neck', label: { ar: 'خلف الرقبة', en: 'Back of neck', fr: 'Arrière du cou' }, keywords: { ar: ['خلف رقبتي','ورا رقبتي','نقره رقبتي'], en: ['back of neck','nape'], fr: ['arrière du cou','nuque'] } },
  { id: 'neck-right', parent: 'neck', label: { ar: 'يمين الرقبة', en: 'Right side of neck', fr: 'Côté droit du cou' }, keywords: { ar: ['يمين رقبتي'], en: ['right side of neck'], fr: ['côté droit'] } },
  { id: 'neck-left', parent: 'neck', label: { ar: 'شمال الرقبة', en: 'Left side of neck', fr: 'Côté gauche du cou' }, keywords: { ar: ['شمال رقبتي'], en: ['left side of neck'], fr: ['côté gauche'] } },

  // أعلى الظهر
  { id: 'upper-back-right', parent: 'upper-back', label: { ar: 'أعلى الظهر يمين', en: 'Upper back right', fr: 'Haut du dos à droite' }, keywords: { ar: ['اعلى ضهري يمين','بين كتافي يمين'], en: ['upper back right'], fr: ['haut du dos à droite'] } },
  { id: 'upper-back-left', parent: 'upper-back', label: { ar: 'أعلى الظهر شمال', en: 'Upper back left', fr: 'Haut du dos à gauche' }, keywords: { ar: ['اعلى ضهري شمال','بين كتافي شمال'], en: ['upper back left'], fr: ['haut du dos à gauche'] } },
  { id: 'upper-back-center', parent: 'upper-back', label: { ar: 'نص أعلى الظهر', en: 'Upper back center', fr: 'Centre haut du dos' }, keywords: { ar: ['نص ضهري من فوق','وسط ضهري من فوق'], en: ['upper back center'], fr: ['centre haut du dos'] } },
  { id: 'upper-back-between', parent: 'upper-back', label: { ar: 'بين الكتفين', en: 'Between shoulders', fr: 'Entre les omoplates' }, keywords: { ar: ['بين الكتفين','بين لوح الكتف'], en: ['between shoulder blades'], fr: ['entre les omoplates'] } },

  // وسط الظهر
  { id: 'mid-back-right', parent: 'mid-back', label: { ar: 'وسط الظهر يمين', en: 'Mid back right', fr: 'Milieu dos droite' }, keywords: { ar: ['وسط ضهري يمين','نص ضهري يمين'], en: ['mid back right'], fr: ['milieu dos droite'] } },
  { id: 'mid-back-left', parent: 'mid-back', label: { ar: 'وسط الظهر شمال', en: 'Mid back left', fr: 'Milieu dos gauche' }, keywords: { ar: ['وسط ضهري شمال','نص ضهري شمال'], en: ['mid back left'], fr: ['milieu dos gauche'] } },
  { id: 'mid-back-center', parent: 'mid-back', label: { ar: 'نص وسط الظهر', en: 'Mid back center', fr: 'Centre milieu dos' }, keywords: { ar: ['وسط ضهري','نص ضهري','منتصف ضهري','منتصف الظهر'], en: ['mid back'], fr: ['milieu du dos'] } },

  // أسفل الظهر
  { id: 'lower-back-right', parent: 'lower-back', label: { ar: 'أسفل الظهر يمين', en: 'Lower back right', fr: 'Bas dos droite' }, keywords: { ar: ['اسفل ضهري يمين','قطني يمين'], en: ['lower back right'], fr: ['bas dos droite'] } },
  { id: 'lower-back-left', parent: 'lower-back', label: { ar: 'أسفل الظهر شمال', en: 'Lower back left', fr: 'Bas dos gauche' }, keywords: { ar: ['اسفل ضهري شمال','قطني شمال'], en: ['lower back left'], fr: ['bas dos gauche'] } },
  { id: 'lower-back-center', parent: 'lower-back', label: { ar: 'نص أسفل الظهر', en: 'Center of lower back', fr: 'Centre du bas du dos' }, keywords: { ar: ['نص اسفل ضهري', 'وسط اسفل ضهري', 'منتصف اسفل ضهري'], en: ['center of lower back', 'middle of lower back'], fr: ['centre du bas du dos', 'milieu du bas du dos'] } },

  // الصدر
  { id: 'chest-right', parent: 'chest', label: { ar: 'الصدر يمين', en: 'Right chest', fr: 'Poitrine droite' }, keywords: { ar: ['صدري يمين'], en: ['right chest'], fr: ['poitrine droite'] } },
  { id: 'chest-left', parent: 'chest', label: { ar: 'الصدر شمال (فوق القلب)', en: 'Left chest', fr: 'Poitrine gauche' }, keywords: { ar: ['صدري شمال','فوق قلبي'], en: ['left chest'], fr: ['poitrine gauche'] } },
  { id: 'chest-center', parent: 'chest', label: { ar: 'نص الصدر', en: 'Center of chest', fr: 'Centre poitrine' }, keywords: { ar: ['نص صدري','قصي'], en: ['center of chest'], fr: ['centre poitrine'] } },
  { id: 'chest-ribs-right', parent: 'chest', label: { ar: 'تحت الضلوع يمين', en: 'Below right ribs', fr: 'Sous côtes droites' }, keywords: { ar: ['تحت ضلوعي يمين'], en: ['below right ribs'], fr: ['sous côtes droites'] } },
  { id: 'chest-ribs-left', parent: 'chest', label: { ar: 'تحت الضلوع شمال', en: 'Below left ribs', fr: 'Sous côtes gauches' }, keywords: { ar: ['تحت ضلوعي شمال'], en: ['below left ribs'], fr: ['sous côtes gauches'] } },

  // الجانب
  { id: 'flank-right', parent: 'obliques', label: { ar: 'الجانب يمين', en: 'Right flank', fr: 'Flanc droit' }, keywords: { ar: ['جنب اليمين', 'جنب يمين', 'الجانب اليمين', 'الجانب يمين', 'الجنب اليمين', 'الجنب يمين', 'اليمين', 'يمين', 'يمنى', 'على اليمين', 'على يمين', 'اليمني', 'جنبي يمين'], en: ['right flank'], fr: ['flanc droit'] } },
  { id: 'flank-left', parent: 'obliques', label: { ar: 'الجانب شمال', en: 'Left flank', fr: 'Flanc gauche' }, keywords: { ar: ['جنب الشمال', 'جنب شمال', 'الجانب الشمال', 'الجانب شمال', 'الجنب الشمال', 'الجنب شمال', 'الشمال', 'شمال', 'يسار', 'على الشمال', 'على شمال', 'الشمالي', 'جنبي شمال'], en: ['left flank'], fr: ['flanc gauche'] } },

  // الكتف
  { id: 'shoulder-right', parent: 'deltoids', label: { ar: 'الكتف يمين', en: 'Right shoulder', fr: 'Épaule droite' }, keywords: { ar: ['كتفي يمين'], en: ['right shoulder'], fr: ['épaule droite'] } },
  { id: 'shoulder-left', parent: 'deltoids', label: { ar: 'الكتف شمال', en: 'Left shoulder', fr: 'Épaule gauche' }, keywords: { ar: ['كتفي شمال'], en: ['left shoulder'], fr: ['épaule gauche'] } },

  // الذراع
  { id: 'arm-right', parent: 'biceps', label: { ar: 'الذراع يمين', en: 'Right upper arm', fr: 'Bras droit' }, keywords: { ar: ['دراعي يمين'], en: ['right upper arm'], fr: ['bras droit'] } },
  { id: 'arm-left', parent: 'biceps', label: { ar: 'الذراع شمال', en: 'Left upper arm', fr: 'Bras gauche' }, keywords: { ar: ['دراعي شمال'], en: ['left upper arm'], fr: ['bras gauche'] } },

  // الساعد
  { id: 'forearm-right', parent: 'forearm', label: { ar: 'الساعد يمين', en: 'Right forearm', fr: 'Avant-bras droit' }, keywords: { ar: ['ساعدي يمين'], en: ['right forearm'], fr: ['avant-bras droit'] } },
  { id: 'forearm-left', parent: 'forearm', label: { ar: 'الساعد شمال', en: 'Left forearm', fr: 'Avant-bras gauche' }, keywords: { ar: ['ساعدي شمال'], en: ['left forearm'], fr: ['avant-bras gauche'] } },

  // اليد
  { id: 'hand-right', parent: 'hands', label: { ar: 'اليد يمين', en: 'Right hand', fr: 'Main droite' }, keywords: { ar: ['ايدي يمين'], en: ['right hand'], fr: ['main droite'] } },
  { id: 'hand-left', parent: 'hands', label: { ar: 'اليد شمال', en: 'Left hand', fr: 'Main gauche' }, keywords: { ar: ['ايدي شمال'], en: ['left hand'], fr: ['main gauche'] } },

  // الأرداف
  { id: 'gluteal-right', parent: 'gluteal', label: { ar: 'الأرداف يمين', en: 'Right buttock', fr: 'Fessier droit' }, keywords: { ar: ['طيزي يمين'], en: ['right buttock'], fr: ['fessier droit'] } },
  { id: 'gluteal-left', parent: 'gluteal', label: { ar: 'الأرداف شمال', en: 'Left buttock', fr: 'Fessier gauche' }, keywords: { ar: ['طيزي شمال'], en: ['left buttock'], fr: ['fessier gauche'] } },
  { id: 'gluteal-center', parent: 'gluteal', label: { ar: 'نص الأرداف', en: 'Center of buttocks', fr: 'Centre fessiers' }, keywords: { ar: ['نص طيزي'], en: ['center of buttocks'], fr: ['centre des fessiers'] } },

  // الفخذ
  { id: 'thigh-right', parent: 'quadriceps', label: { ar: 'الفخذ يمين', en: 'Right thigh', fr: 'Cuisse droite' }, keywords: { ar: ['فخذي يمين'], en: ['right thigh'], fr: ['cuisse droite'] } },
  { id: 'thigh-left', parent: 'quadriceps', label: { ar: 'الفخذ شمال', en: 'Left thigh', fr: 'Cuisse gauche' }, keywords: { ar: ['فخذي شمال'], en: ['left thigh'], fr: ['cuisse gauche'] } },

  // الركبة
  { id: 'knee-right', parent: 'knees', label: { ar: 'الركبة يمين', en: 'Right knee', fr: 'Genou droit' }, keywords: { ar: ['ركبتي يمين'], en: ['right knee'], fr: ['genou droit'] } },
  { id: 'knee-left', parent: 'knees', label: { ar: 'الركبة شمال', en: 'Left knee', fr: 'Genou gauche' }, keywords: { ar: ['ركبتي شمال'], en: ['left knee'], fr: ['genou gauche'] } },

  // السمانة
  { id: 'calf-right', parent: 'calves', label: { ar: 'السمانة يمين', en: 'Right calf', fr: 'Mollet droit' }, keywords: { ar: ['سمانتي يمين'], en: ['right calf'], fr: ['mollet droit'] } },
  { id: 'calf-left', parent: 'calves', label: { ar: 'السمانة شمال', en: 'Left calf', fr: 'Mollet gauche' }, keywords: { ar: ['سمانتي شمال'], en: ['left calf'], fr: ['mollet gauche'] } },

  // الكاحل
  { id: 'ankle-right', parent: 'ankles', label: { ar: 'الكاحل يمين', en: 'Right ankle', fr: 'Cheville droite' }, keywords: { ar: ['كاحلي يمين'], en: ['right ankle'], fr: ['cheville droite'] } },
  { id: 'ankle-left', parent: 'ankles', label: { ar: 'الكاحل شمال', en: 'Left ankle', fr: 'Cheville gauche' }, keywords: { ar: ['كاحلي شمال'], en: ['left ankle'], fr: ['cheville gauche'] } },

  // الرجل
  { id: 'leg-right', parent: 'legs', label: { ar: 'الرجل يمين', en: 'Right leg', fr: 'Jambe droite' }, keywords: { ar: ['رجلي يمين'], en: ['right leg'], fr: ['jambe droite'] } },
  { id: 'leg-left', parent: 'legs', label: { ar: 'الرجل شمال', en: 'Left leg', fr: 'Jambe gauche' }, keywords: { ar: ['رجلي شمال'], en: ['left leg'], fr: ['jambe gauche'] } },

  // القدم
  { id: 'foot-right', parent: 'feet', label: { ar: 'القدم يمين', en: 'Right foot', fr: 'Pied droit' }, keywords: { ar: ['قدمي يمين'], en: ['right foot'], fr: ['pied droit'] } },
  { id: 'foot-left', parent: 'feet', label: { ar: 'القدم شمال', en: 'Left foot', fr: 'Pied gauche' }, keywords: { ar: ['قدمي شمال'], en: ['left foot'], fr: ['pied gauche'] } },
];

export const MEDICATION_TERMS: MedicationTerm[] = [
  { id: 'paracetamol', label: { ar: 'بنادول / باراسيتامول', en: 'Panadol / paracetamol', fr: 'Panadol / paracétamol' }, keywords: { ar: ['بنادول', 'باراسيتامول', 'باراسيتامول'], en: ['panadol', 'paracetamol', 'acetaminophen'], fr: ['panadol', 'paracétamol'] }, caution: { ar: 'لا تكرر الجرعة أو تجمعه مع دواء آخر قبل مراجعة النشرة أو الصيدلي.', en: 'Do not repeat or combine doses without checking the label or a pharmacist.', fr: 'Ne répétez pas ou ne combinez pas les doses sans vérifier la notice ou demander au pharmacien.' } },
  { id: 'ibuprofen', label: { ar: 'بروفين / إيبوبروفين', en: 'Brufen / ibuprofen', fr: 'Brufen / ibuprofène' }, keywords: { ar: ['بروفين', 'ايبوبروفين', 'إيبوبروفين'], en: ['brufen', 'ibuprofen'], fr: ['brufen', 'ibuprofène'] }, caution: { ar: 'اسأل الصيدلي قبل استخدامه مع قرحة المعدة أو مشاكل الكلى أو الحمل أو مميعات الدم.', en: 'Ask a pharmacist first with ulcers, kidney disease, pregnancy, or blood thinners.', fr: 'Demandez au pharmacien en cas d’ulcère, maladie rénale, grossesse ou anticoagulants.' } },
  { id: 'diclofenac', label: { ar: 'فولتارين / كتافلام', en: 'Voltaren / diclofenac', fr: 'Voltaren / diclofénac' }, keywords: { ar: ['فولتارين', 'كتافلام', 'ديكلوفيناك'], en: ['voltaren', 'diclofenac'], fr: ['voltaren', 'diclofénac'] }, caution: { ar: 'لا تجمعه مع مسكنات مضادة للالتهاب أخرى دون سؤال الصيدلي.', en: 'Do not combine it with other anti-inflammatory painkillers without pharmacist advice.', fr: 'Ne l’associez pas à d’autres anti-inflammatoires sans avis pharmaceutique.' } },
  { id: 'aspirin', label: { ar: 'أسبرين', en: 'Aspirin', fr: 'Aspirine' }, keywords: { ar: ['اسبرين', 'أسبرين'], en: ['aspirin'], fr: ['aspirine'] }, caution: { ar: 'اذكر أي حساسية أو نزيف أو استخدام لمميعات الدم للطبيب أو الصيدلي.', en: 'Tell a clinician or pharmacist about allergy, bleeding, or blood thinners.', fr: 'Signalez toute allergie, saignement ou anticoagulant au professionnel.' } },
];

export const FOLLOW_UP_QUESTIONS: LocalizedText[] = [
  { ar: 'الألم بيزيد مع إيه؟', en: 'What makes the pain worse?', fr: 'Qu’est-ce qui aggrave la douleur ?' },
  { ar: 'فيه أعراض تانية زي تنميل أو حرارة أو دوخة؟', en: 'Any other symptoms such as numbness, fever, or dizziness?', fr: 'D’autres symptômes comme engourdissement, fièvre ou vertiges ?' },
  { ar: 'بتحس بوخز أو حرقان؟', en: 'Do you feel tingling or burning?', fr: 'Ressentez-vous des fourmillements ou une brûlure ?' },
];

export const SYMPTOM_QUICK_CHIPS: LocalizedText[] = [
  { ar: 'فيه تنميل', en: 'There is numbness', fr: 'Il y a un engourdissement' },
  { ar: 'فيه حرارة', en: 'There is fever', fr: 'Il y a de la fièvre' },
  { ar: 'فيه تورم', en: 'There is swelling', fr: 'Il y a un gonflement' },
  { ar: 'بيزيد مع الحركة', en: 'It worsens with movement', fr: 'Cela augmente avec le mouvement' },
  { ar: 'بيهدأ مع الراحة', en: 'It improves with rest', fr: 'Cela s’améliore au repos' },
];
