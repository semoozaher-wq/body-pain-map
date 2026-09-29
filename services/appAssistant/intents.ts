// services/appAssistant/intents.ts
// ============================================================================
// محلّل النوايا (Natural Language → Structured Intents)
// ----------------------------------------------------------------------------
// يحوّل جملة المستخدم الحرة (عربي/إنجليزي/فرنسي) إلى قائمة نوايا منظّمة.
// يدعم:
//   • التنقّل بين الشاشات والأقسام ("روح للأعضاء").
//   • الإبراز/التحديد ("علم على القلب"، "وريني الركبة").
//   • الفهم المكاني ("اللي فوقه إيه؟"، "طب تحته؟").
//   • الفلترة والبحث ("نقاط اليد"، "ابحث عن ألم أسفل الظهر").
//   • المهام متعددة الخطوات ("روح لخريطة الألم وسجل ألم شدته 7").
//   • الضمائر المرجعية ("ده"، "دي"، "هنا"، "اللي اخترناه").
// ============================================================================

import { normalize, isMidBackTerm } from './catalog';
import type { Direction } from './spatial';
import type { Lang } from './types';

export type IntentKind =
  | 'navigate_screen'
  | 'open_tab'
  | 'highlight'
  | 'select'
  | 'filter'
  | 'search'
  | 'back'
  | 'home'
  | 'save'
  | 'clear_history'
  | 'show_details'
  | 'clear_highlight'
  | 'spatial_query'
  | 'set_view'
  | 'set_sex'
  | 'zoom'
  | 'describe_screen'
  | 'record_pain'
  | 'locate_pain'
  | 'move_marker'
  | 'open_last_entry'
  | 'doctor_summary'
  | 'medications'
  | 'close'
  | 'unknown';

export interface RawIntent {
  kind: IntentKind;
  /** نص الهدف (يُطابَق مع الكتالوج). */
  targetTerm?: string;
  direction?: Direction;
  /** نص البحث/الفلترة. */
  query?: string;
  /** قيمة رقمية (شدّة الألم، مستوى التكبير…). */
  value?: number;
  /** يشير إلى العنصر المرجعي في السياق (ضمير). */
  refersToContext?: boolean;
  /** طلب صريح (مثل «سجّل») يحتاج تأكيدًا، مقابل استكمال محادثة (مثل «شدته 7»). */
  explicit?: boolean;
  raw: string;
}

// ---------------------------------------------------------------------------
// مفردات النوايا
// ---------------------------------------------------------------------------
const VERBS = {
  navigate: [
    'روح', 'روحني', 'وديني', 'وديني', 'خدني', 'افتح', 'افتحلي', 'فتح', 'انتقل', 'اذهب',
    'خليني اشوف', 'خليني اروح', 'عايز اشوف', 'عايز اروح', 'اريد اشوف', 'عاوز اشوف',
    'go to', 'navigate', 'take me', 'open', 'show me', 'aller', 'emmene', 'ouvre', 'montre',
  ],
  highlight: [
    'علم', 'علملي', 'علم عليه', 'علم عليها', 'وريني', 'ورينى', 'بص على', 'بص', 'حدد', 'حددلي',
    'ضلل', 'اشاور', 'وضح', 'فين', 'highlight', 'point to', 'show me', 'mark', 'montre', 'indique',
  ],
  where: ['فين', 'وين', 'اين', 'where', 'ou est', 'où est'],
  what: ['ايه', 'إيه', 'ايش', 'what', 'qu est', "qu'est"],
  filter: ['نقاط', 'فلتر', 'filter', 'points', 'نقط'],
  search: ['ابحث', 'بحث', 'دور', 'search', 'cherche', 'recherche'],
  back: ['ارجع', 'رجوع', 'رجعني', 'back', 'retour', 'reviens'],
  home: ['الرئيسيه', 'الرئيسية', 'للرئيسيه', 'للرئيسية', 'رئيسي', 'الصفحة الرئيسية', 'home', 'accueil', 'البدايه'],
  save: ['سجل', 'احفظ', 'احفظلي', 'سجللي', 'save', 'enregistre', 'record'],
  clearHistory: ['امسح', 'احذف', 'مسح', 'حذف', 'الغي', 'delete', 'clear', 'efface', 'supprime'],
  showDetails: ['التفاصيل', 'تفاصيل', 'details', 'detail'],
  clearHighlight: ['شيل', 'ازال', 'الغي الابراز', 'اقفل الابراز', 'remove highlight', 'clear highlight', 'enleve'],
  close: ['اقفل', 'اقفلي', 'اغلق', 'غلق', 'اقفل المساعد', 'اقفل اللوحه', 'اقفل اللوحة', 'اقفل الشات', 'اقفل المحادثه', 'اقفل المحادثة', 'اطلع', 'خروج', 'close', 'ferme', 'quit', 'exit'],
  zoom: ['زوم', 'كبر', 'صغر', 'تكبير', 'تصغير', 'zoom', 'agrandir', 'reduire'],
};

const DIRECTION_WORDS: Array<{ dir: Direction; words: string[] }> = [
  { dir: 'above', words: ['فوق', 'فوقه', 'فوقها', 'فوقيه', 'اعلى', 'أعلى', 'above', 'over', 'au dessus', 'dessus', 'haut'] },
  { dir: 'below', words: ['تحت', 'تحته', 'تحتها', 'تحتيه', 'اسفل', 'أسفل', 'below', 'under', 'sous', 'bas'] },
  { dir: 'right', words: ['يمين', 'يمينه', 'يمينها', 'على اليمين', 'ناحيه اليمين', 'right', 'droite'] },
  { dir: 'left', words: ['شمال', 'شماله', 'شمالها', 'يسار', 'يساره', 'على الشمال', 'ناحيه الشمال', 'left', 'gauche'] },
  { dir: 'between_two', words: ['بين الاتنين', 'بينهم', 'بين ده وده', 'بين دي ودي', 'بين الاثنين', 'between the two', 'entre les deux'] },
  { dir: 'in_front', words: ['قدام', 'قدامه', 'قدامها', 'قبله', 'in front', 'devant'] },
  { dir: 'behind', words: ['ورا', 'وراه', 'وراها', 'وراء', 'خلف', 'خلفه', 'خلفها', 'behind', 'derriere', 'derrière'] },
  { dir: 'diagonal', words: ['قطري', 'قطريا', 'قطريًا', 'بزاويه', 'بزاوية', 'diagonal'] },
  { dir: 'far', words: ['بعيد', 'بعيده', 'بعيده عن', 'بعيدا', 'بعيدًا', 'far', 'loin'] },
  { dir: 'near', words: ['جنب', 'جنبه', 'جنبها', 'بجوار', 'قريب', 'قريبه', 'جانب', 'near', 'next to', 'a cote', 'pres de', 'proche'] },
  { dir: 'between', words: ['بين', 'between', 'entre'] },
];

const VIEW_WORDS = {
  front: ['الامام', 'امام', 'الامامي', 'front', 'avant', 'devant'],
  back: ['الظهر', 'ظهر', 'الخلف', 'back', 'dos', 'arriere'],
};

// أفعال تغيير العرض/النموذج: لا نُفعّل «تغيير العرض» بمجرّد ورود اسم عضو مثل «الظهر» (لأنه عضو في الجسم أيضًا).
const VIEW_VERBS = ['عرض', 'اعرض', 'أعرض', 'وريني', 'ورينى', 'شوف', 'اظهر', 'أظهر', 'front view', 'back view', 'affiche'];
// كلمات سياق النموذج (بدون «رجل» لأنها تعني العضو أيضًا).
const SEX_VERBS = {
  male: ['نموذج', 'ذكر', 'ذكري', 'الذكري', 'ذكوري', 'male', 'homme'],
  female: ['نموذج', 'انثى', 'انثي', 'انثوي', 'الانثوي', 'انثويه', 'ست', 'female', 'femme'],
};

// ضمائر/إشارات مرجعية إلى السياق
const CONTEXT_REFERENTS = [
  'ده', 'دي', 'دا', 'هنا', 'هذا', 'هذه', 'ده', 'اللي اخترناه', 'اللي اخترناه', 'المحدد',
  'اللي قبلها', 'اللي قبل كده', 'السابق', 'عليه', 'عليها', 'عليا', 'عليهو', 'عليهما',
  'this', 'it', 'here', 'ceci', 'cela', 'ici',
];

// صيغ «شيله/امسحه» المرجعية لإزالة الإبراز بدون ذكر كلمة «الإبراز» صراحةً.
const CLEAR_HIGHLIGHT_REFERENTS = ['شيله', 'شيلي', 'شيلها', 'شيلو', 'امسحه', 'امسحي', 'امسحها', 'ازاله', 'أزيله'];

// كلمات الشكوى من الألم (تضع علامة على الخريطة وتطلب الدقة)
const PAIN_WORDS = [
  'وجع', 'بيوجعني', 'بتوجعني', 'وجعني', 'بيوجعنى', 'ألم', 'الم', 'بيألم', 'بتألم', 'يألم',
  'بتالم', 'pain', 'hurts', 'hurting', 'douleur', 'mal',
];

// أفعال وضع/تحريك العلامة
const MARKER_VERBS = [
  'حط علامه', 'حط علامة', 'ضع علامه', 'ضع علامة', 'علم على مكان', 'حدد مكان', 'حددلي مكان',
  'place marker', 'set marker', 'marker',
];

// كلمات الأدوية
const MEDICATION_WORDS = [
  'الادويه', 'الأدوية', 'ادويه', 'أدوية', 'دواء', 'medications', 'drugs', 'medicaments', 'médicaments',
];

// كلمات حشو تُزال من نص البحث/الفلترة (لا تحمل اسم هدف)
const FILLER_WORDS = [
  'عايز', 'عاوز', 'اريد', 'أريد', 'اعرف', 'أعرف', 'ابغى', 'ممكن', 'لو سمحت', 'من فضلك',
  'عن', 'في', 'على', 'علي', 'من', 'ايه', 'إيه', 'ايش', 'هو', 'هي', 'بتاع', 'بتاعة', 'حاجه', 'حاجة',
  'please', 'about', 'the', 'a', 'an', 'le', 'la', 'les', 'de', 'du', 'sur',
];

// ---------------------------------------------------------------------------
// أدوات مساعدة
// ---------------------------------------------------------------------------
function tokenize(text: string): string[] {
  return text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

function hasAny(text: string, words: string[]): boolean {
  return words.some((w) => {
    const nw = normalize(w);
    if (!nw) return false;
    // مطابقة كلمة كاملة أو جذر داخل النص (العربية تلصق الضمائر والسوابق).
    return text === nw || text.includes(nw);
  });
}

// مطابقة كلمات الألم: الكلمات القصيرة (مثل «الم») تُطابَق كوحدة كاملة لتجنّب مطابقة «المعلومات»/«المعدة».
const PAIN_TOKENS = new Set(PAIN_WORDS.map((w) => normalize(w)).filter(Boolean));
function hasPainWord(text: string): boolean {
  const toks = tokenize(text);
  if (toks.some((t) => PAIN_TOKENS.has(t))) return true;
  return PAIN_WORDS.map((w) => normalize(w))
    .filter((w) => w.length >= 4)
    .some((w) => text.includes(w));
}

function findDirection(text: string): Direction | undefined {
  // «الفرق بين X و Y» سؤال معرفة عامة، وليس سؤالًا مكانيًّا. كلمة «بين» هنا ليست اتجاهًا.
  const isDifferenceQuestion =
    text.includes('الفرق') || text.includes('difference') || text.includes('difference');
  for (const { dir, words } of DIRECTION_WORDS) {
    if (dir === 'between' && isDifferenceQuestion) continue;
    if (hasAny(text, words)) return dir;
  }
  return undefined;
}

/** يستخرج الشدّة من نص مثل "شدته 7 من 10" أو "7/10". */
function findSeverity(text: string): number | undefined {
  const m =
    text.match(/(\d+)\s*(?:\/|من|out of|sur)\s*10/) ||
    text.match(/شد[ته][^\s\d]*\s*(?:الالم\s*)?(\d+)/) ||
    text.match(/severity\s*(\d+)/) ||
    text.match(/(\d+)\s*\/\s*10/);
  if (m) {
    const value = Number(m[1]);
    if (value >= 0 && value <= 10) return value;
  }
  return undefined;
}

/** يزيل أفعال الأمر والكلمات الوظيفية ليبقى الاسم الهدف. */
function stripVerbs(text: string): string {
  let result = text;
  const allVerbs = [
    ...VERBS.navigate, ...VERBS.highlight, ...VERBS.filter, ...VERBS.search,
    ...VERBS.back, ...VERBS.save, ...VERBS.zoom, ...VERBS.showDetails,
  ];
  // نرتّب حسب الطول تنازليًا حتى تُزال الأفعال المركّبة (مثل «روحني») قبل جذورها («روح»).
  const ordered = allVerbs
    .map((v) => normalize(v))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  for (const nv of ordered) {
    result = result.split(nv).join(' ');
  }
  // إزالة كلمات الشكوى والحشو كوحدات كاملة (لتجنّب تخريب أسماء مثل «المعدة» التي تحتوي «الم»).
  const drop = new Set([...PAIN_WORDS, ...FILLER_WORDS].map((w) => normalize(w)).filter(Boolean));
  result = tokenize(result).filter((tok) => !drop.has(tok)).join(' ');
  // إزالة حروف الجر/الوصل الشائعة في بداية الاسم.
  result = result.replace(/\b(ل|على|علي|في|عن|من|to|the|le|la|les|de|du)\b/g, ' ');
  return result.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// المحلّل الرئيسي
// ---------------------------------------------------------------------------
export function parseIntents(
  utterance: string,
  _lang: Lang,
  ctx: { hasBase?: boolean } = {},
): RawIntent[] {
  const text = normalize(utterance);
  if (!text) return [{ kind: 'unknown', raw: utterance }];

  const intents: RawIntent[] = [];
  const tokens = tokenize(text);
  const direction = findDirection(text);
  const severity = findSeverity(text);
  const refersToContext = CONTEXT_REFERENTS.some((r) => text.includes(normalize(r)));
  const hasBase = !!ctx.hasBase;
  const hasViewVerb = hasAny(text, VIEW_VERBS);

  // --- إغلاق المساعد (أولوية قصوى: «اقفل» / «اقفل المساعد») ---
  // نستثني «اقفل الإبراز» لأنها تعني إزالة الإبراز لا إغلاق اللوحة.
  const wantsCloseHighlight =
    text.includes('الابراز') || text.includes('highlight') || text.includes('العلامه') || text.includes('العلامة');
  if (hasAny(text, VERBS.close) && !wantsCloseHighlight) {
    return [{ kind: 'close', raw: utterance }];
  }

  const isQuestion = tokens.some((t) => VERBS.what.includes(t) || VERBS.where.includes(t)) || text.includes('?') || text.includes('؟');
  const hasWhere = hasAny(text, VERBS.where);

  // --- رجوع / رئيسية ---
  if (hasAny(text, VERBS.back)) intents.push({ kind: 'back', raw: utterance });
  if (hasAny(text, VERBS.home)) intents.push({ kind: 'home', raw: utterance });

  // --- مسح السجل (خطر) ---
  if (hasAny(text, VERBS.clearHistory) && (text.includes('سجل') || text.includes('history') || text.includes('historique') || text.includes('الالم') || text.includes('الكل'))) {
    intents.push({ kind: 'clear_history', raw: utterance });
  }

  // --- فتح سجل الألم (تنقّل) ---
  const wantsHistory =
    !hasAny(text, VERBS.clearHistory) &&
    (text.includes('سجل') || text.includes('history') || text.includes('historique') || text.includes('log')) &&
    (text.includes('الالم') || text.includes('الوجع') || text.includes('history') || text.includes('historique') || text.includes('السجل') || text.includes('سجل الالم'));
  if (wantsHistory) {
    intents.push({ kind: 'navigate_screen', targetTerm: 'history', raw: utterance });
  }

  // --- فتح شاشة المعلومات الصحية ---
  if (
    text.includes('المعلومات الصحيه') ||
    text.includes('معلومات صحيه') ||
    text.includes('health info') ||
    text.includes('infos sante') ||
    text.includes('infos santé')
  ) {
    intents.push({ kind: 'navigate_screen', targetTerm: 'health', raw: utterance });
  }

  // --- إزالة الإبراز ---
  // نسمح بصيغ مرجعية مثل «شيله»/«امسحه» عندما يكون هناك سياق/علامة حالية، بدل اشتراط كلمة «الإبراز» صراحةً.
  const wantsClearHighlightWord = text.includes('الابراز') || text.includes('highlight') || text.includes('العلامه') || text.includes('العلامة');
  const clearHighlightReferent = refersToContext || hasBase || CLEAR_HIGHLIGHT_REFERENTS.some((w) => text.includes(normalize(w)));
  if (hasAny(text, VERBS.clearHighlight) && (wantsClearHighlightWord || clearHighlightReferent)) {
    intents.push({ kind: 'clear_highlight', raw: utterance });
  }

  // --- العرض (أمام/ظهر) والنموذج (رجل/امرأة) ---
  // ملاحظة مهمة: «ظهر» اسم عضوٍ في الجسم أيضًا، فلا نعتبره أمر تغيير عرضٍ إلا إذا لم تكن الجملة شكوى ألم.
  // (شكوى مثل «عندي وجع في ظهري» يجب أن تُصنَّف طبية، لا أمر تحكّم.)
  const isPainComplaint =
    hasPainWord(text) &&
    !hasAny(text, VERBS.save) &&
    !hasAny(text, VERBS.navigate) &&
    !text.includes('سجل') &&
    !text.includes('history') &&
    !wantsHistory;
  if (hasAny(text, VIEW_WORDS.front) && hasViewVerb && !isPainComplaint) intents.push({ kind: 'set_view', value: 0, targetTerm: 'front', raw: utterance });
  if (hasAny(text, VIEW_WORDS.back) && hasViewVerb && !isPainComplaint) intents.push({ kind: 'set_view', value: 0, targetTerm: 'back', raw: utterance });
  if (hasAny(text, SEX_VERBS.male) && !isPainComplaint) intents.push({ kind: 'set_sex', targetTerm: 'male', raw: utterance });
  if (hasAny(text, SEX_VERBS.female) && !isPainComplaint) intents.push({ kind: 'set_sex', targetTerm: 'female', raw: utterance });

  // --- تكبير ---
  if (hasAny(text, VERBS.zoom)) {
    const zoomIn = text.includes('كبر') || text.includes('زوم') || text.includes('zoom') || text.includes('agrandir');
    intents.push({ kind: 'zoom', value: zoomIn ? 1 : -1, raw: utterance });
  }

  // --- بحث ---
  if (hasAny(text, VERBS.search)) {
    const query = stripVerbs(text.replace(/ابحث|بحث|دور|search|cherche|recherche/g, ' '));
    intents.push({ kind: 'search', query: query || undefined, raw: utterance });
  }

  // --- فلترة (نقاط الضغط حسب المنطقة) ---
  if (hasAny(text, VERBS.filter) && (text.includes('نقاط') || text.includes('نقط') || text.includes('points') || text.includes('الضغط'))) {
    const query = stripVerbs(text.replace(/نقاط|نقط|points|الضغط|فلتر|filter/g, ' '));
    intents.push({ kind: 'filter', query: query || undefined, raw: utterance });
  }

  // --- وصف الشاشة الحالية ---
  if ((text.includes('انا فين') || text.includes('فين انا') || text.includes('ايه اللي قدامي') || text.includes('ايه اللي على الشاشه') || text.includes('what am i looking at') || text.includes('describe'))) {
    intents.push({ kind: 'describe_screen', raw: utterance });
  }

  // --- سؤال مكاني نسبي ---
  if (direction && (isQuestion || hasWhere || text.includes('اللي') || direction === 'between_two')) {
    const target = stripVerbs(text);
    intents.push({ kind: 'spatial_query', direction, targetTerm: target || undefined, refersToContext, raw: utterance });
  }

  // --- إبراز/تحديد/سؤال "فين" ---
  const hasHighlightVerb = hasAny(text, VERBS.highlight);
  if ((hasHighlightVerb || hasWhere) && !wantsHistory && !intents.some((i) => i.kind === 'filter' || i.kind === 'spatial_query')) {
    const target = stripVerbs(text);
    intents.push({ kind: 'highlight', targetTerm: target || undefined, refersToContext, raw: utterance });
  }

  // --- تنقّل لشاشة/قسم ---
  if (hasAny(text, VERBS.navigate) && !wantsHistory) {
    const target = stripVerbs(text);
    intents.push({ kind: 'navigate_screen', targetTerm: target || undefined, raw: utterance });
    intents.push({ kind: 'open_tab', targetTerm: target || undefined, raw: utterance });
  }

  // --- تسجيل ألم بشدّة محدّدة (متعدد الخطوات) ---
  if (severity !== undefined) {
    const target = stripVerbs(text);
    intents.push({ kind: 'record_pain', value: severity, targetTerm: target || undefined, refersToContext, explicit: hasAny(text, VERBS.save), raw: utterance });
  } else if (
    hasAny(text, VERBS.save) &&
    (text.includes('الم') || text.includes('وجع') || text.includes('pain') || text.includes('mal')) &&
    !wantsHistory
  ) {
    // طلب حفظ صريح لألم → إجراء حسّاس يحتاج تأكيدًا.
    intents.push({ kind: 'save', raw: utterance });
  }

  // --- حفظ عام (طلب صريح) ---
  if (
    hasAny(text, VERBS.save) &&
    !intents.some((i) => i.kind === 'record_pain' || i.kind === 'save') &&
    !hasAny(text, VERBS.clearHistory) &&
    !wantsHistory
  ) {
    intents.push({ kind: 'save', raw: utterance });
  }

  // --- عرض التفاصيل ---
  if (hasAny(text, VERBS.showDetails)) intents.push({ kind: 'show_details', raw: utterance });

  // --- تحديد/وضع علامة الألم على الخريطة (شكوى ألم أو طلب صريح) ---
  const hasMarkerVerb = hasAny(text, MARKER_VERBS);
  // «وسط الظهر/نص الظهر/في النص/وسط» تُعدّ تحديدًا لمكان الألم (وسط الظهر) حتى بلا كلمة ألم،
  // لأن المستخدم غالبًا يذكر الموقع مباشرة بعد شكوى سابقة («عندي وجع في ظهري» → «وسط الظهر»).
  const mentionsMidBack = isMidBackTerm(text);
  if (isPainComplaint || hasMarkerVerb || mentionsMidBack) {
    const target = stripVerbs(text);
    // نحمل الاتجاه المذكور داخل الجملة ("تحت صدري بشوية"، "جنب القلب ناحية الشمال")
    // حتى تزيح طبقة المحرّك العلامة عن إحداثيات الهدف الحقيقية بدل تجاهله.
    intents.push({ kind: 'locate_pain', targetTerm: target || undefined, direction, refersToContext, value: severity, raw: utterance });
  }

  // --- تحريك علامة الألم الحالية ("تحت شوية"، "ناحية اليمين") ---
  const isDirectionalOnly =
    direction &&
    !isQuestion &&
    !hasWhere &&
    !text.includes('اللي') &&
    (refersToContext || hasMarkerVerb || hasBase || text.includes('شويه') || text.includes('شوية') || text.includes('بتاع') || text.includes('علامه') || text.includes('علامة') || text.includes('ناحيه') || text.includes('ناحية') || text.includes('جنب') || text.includes('جوه'));
  if (isDirectionalOnly && !intents.some((i) => i.kind === 'locate_pain')) {
    intents.push({ kind: 'move_marker', direction, refersToContext: true, raw: utterance });
  }

  // --- فتح آخر تسجيل في سجل الألم ---
  if (
    (text.includes('اخر') || text.includes('آخر') || text.includes('latest') || text.includes('dernier')) &&
    (text.includes('تسجيل') || text.includes('سجل') || text.includes('الام') || text.includes('ألم') || text.includes('entry') || text.includes('history'))
  ) {
    intents.push({ kind: 'open_last_entry', raw: utterance });
  }

  // --- ملخص للطبيب / تقرير ---
  if (
    (text.includes('ملخص') || text.includes('تقرير') || text.includes('summary') || text.includes('rapport') || text.includes('report')) &&
    (text.includes('دكتور') || text.includes('طبيب') || text.includes('doctor') || text.includes('medecin') || text.includes('médecin') || text.includes('ملخص') || text.includes('تقرير'))
  ) {
    intents.push({ kind: 'doctor_summary', raw: utterance });
  }

  // --- الأدوية (فتح/بحث فقط) ---
  if (hasAny(text, MEDICATION_WORDS)) {
    const query = stripVerbs(text.replace(/الادويه|الأدوية|ادويه|أدوية|دواء|medications|drugs|medicaments|médicaments/g, ' '));
    intents.push({ kind: 'medications', query: query || undefined, raw: utterance });
  }

  if (!intents.length) intents.push({ kind: 'unknown', raw: utterance });
  return intents;
}

export { findDirection, findSeverity, stripVerbs, hasAny, tokenize };
