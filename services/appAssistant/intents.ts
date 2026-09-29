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

import { normalize } from './catalog';
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
  home: ['الرئيسيه', 'الرئيسية', 'الصفحة الرئيسية', 'home', 'accueil', 'البدايه'],
  save: ['سجل', 'احفظ', 'احفظلي', 'سجللي', 'save', 'enregistre', 'record'],
  clearHistory: ['امسح', 'احذف', 'مسح', 'حذف', 'الغي', 'delete', 'clear', 'efface', 'supprime'],
  showDetails: ['التفاصيل', 'تفاصيل', 'details', 'detail'],
  clearHighlight: ['شيل', 'ازال', 'الغي الابراز', 'اقفل الابراز', 'remove highlight', 'clear highlight', 'enleve'],
  zoom: ['زوم', 'كبر', 'صغر', 'تكبير', 'تصغير', 'zoom', 'agrandir', 'reduire'],
};

const DIRECTION_WORDS: Array<{ dir: Direction; words: string[] }> = [
  { dir: 'above', words: ['فوق', 'فوقه', 'فوقها', 'فوقيه', 'اعلى', 'أعلى', 'above', 'over', 'au dessus', 'dessus', 'haut'] },
  { dir: 'below', words: ['تحت', 'تحته', 'تحتها', 'تحتيه', 'اسفل', 'أسفل', 'below', 'under', 'sous', 'bas'] },
  { dir: 'right', words: ['يمين', 'يمينه', 'يمينها', 'على اليمين', 'ناحيه اليمين', 'right', 'droite'] },
  { dir: 'left', words: ['شمال', 'شماله', 'شمالها', 'يسار', 'يساره', 'على الشمال', 'ناحيه الشمال', 'left', 'gauche'] },
  { dir: 'near', words: ['جنب', 'جنبه', 'جنبها', 'بجوار', 'قريب', 'قريبه', 'جانب', 'near', 'next to', 'a cote', 'pres de', 'proche'] },
  { dir: 'between', words: ['بين', 'between', 'entre'] },
];

const VIEW_WORDS = {
  front: ['الامام', 'امام', 'الامامي', 'front', 'avant', 'devant'],
  back: ['الظهر', 'ظهر', 'الخلف', 'back', 'dos', 'arriere'],
};

const SEX_WORDS = {
  male: ['رجل', 'ذكر', 'male', 'homme'],
  female: ['انثى', 'انثي', 'ست', 'female', 'femme'],
};

// ضمائر/إشارات مرجعية إلى السياق
const CONTEXT_REFERENTS = [
  'ده', 'دي', 'دا', 'هنا', 'هذا', 'هذه', 'ده', 'اللي اخترناه', 'اللي اخترناه', 'المحدد',
  'اللي قبلها', 'اللي قبل كده', 'السابق', 'this', 'it', 'here', 'ceci', 'cela', 'ici',
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

function findDirection(text: string): Direction | undefined {
  for (const { dir, words } of DIRECTION_WORDS) {
    if (hasAny(text, words)) return dir;
  }
  return undefined;
}

/** يستخرج الشدّة من نص مثل "شدته 7 من 10" أو "7/10". */
function findSeverity(text: string): number | undefined {
  const m =
    text.match(/(\d+)\s*(?:\/|من|out of|sur)\s*10/) ||
    text.match(/شده\s*(?:الالم\s*)?(\d+)/) ||
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
  for (const verb of allVerbs) {
    const nv = normalize(verb);
    if (!nv) continue;
    result = result.split(nv).join(' ');
  }
  // إزالة حروف الجر/الوصل الشائعة في بداية الاسم.
  result = result.replace(/\b(ل|على|علي|في|عن|من|to|the|le|la|les|de|du)\b/g, ' ');
  return result.replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// المحلّل الرئيسي
// ---------------------------------------------------------------------------
export function parseIntents(utterance: string, _lang: Lang): RawIntent[] {
  const text = normalize(utterance);
  if (!text) return [{ kind: 'unknown', raw: utterance }];

  const intents: RawIntent[] = [];
  const tokens = tokenize(text);
  const direction = findDirection(text);
  const severity = findSeverity(text);
  const refersToContext = CONTEXT_REFERENTS.some((r) => text.includes(normalize(r)));

  const isQuestion = tokens.some((t) => VERBS.what.includes(t) || VERBS.where.includes(t)) || text.includes('?') || text.includes('؟');
  const hasWhere = hasAny(text, VERBS.where);

  // --- رجوع / رئيسية ---
  if (hasAny(text, VERBS.back)) intents.push({ kind: 'back', raw: utterance });
  if (hasAny(text, VERBS.home)) intents.push({ kind: 'home', raw: utterance });

  // --- مسح السجل (خطر) ---
  if (hasAny(text, VERBS.clearHistory) && (text.includes('سجل') || text.includes('history') || text.includes('historique') || text.includes('الالم') || text.includes('الكل'))) {
    intents.push({ kind: 'clear_history', raw: utterance });
  }

  // --- إزالة الإبراز ---
  if (hasAny(text, VERBS.clearHighlight) && (text.includes('الابراز') || text.includes('highlight') || text.includes('العلامه') || text.includes('العلامة'))) {
    intents.push({ kind: 'clear_highlight', raw: utterance });
  }

  // --- العرض (أمام/ظهر) والنموذج (رجل/امرأة) ---
  if (hasAny(text, VIEW_WORDS.front)) intents.push({ kind: 'set_view', value: 0, targetTerm: 'front', raw: utterance });
  if (hasAny(text, VIEW_WORDS.back)) intents.push({ kind: 'set_view', value: 0, targetTerm: 'back', raw: utterance });
  if (hasAny(text, SEX_WORDS.male)) intents.push({ kind: 'set_sex', targetTerm: 'male', raw: utterance });
  if (hasAny(text, SEX_WORDS.female)) intents.push({ kind: 'set_sex', targetTerm: 'female', raw: utterance });

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
  if (direction && (isQuestion || hasWhere || text.includes('اللي'))) {
    const target = stripVerbs(text);
    intents.push({ kind: 'spatial_query', direction, targetTerm: target || undefined, refersToContext, raw: utterance });
  }

  // --- إبراز/تحديد/سؤال "فين" ---
  const hasHighlightVerb = hasAny(text, VERBS.highlight);
  if (hasHighlightVerb || hasWhere) {
    const target = stripVerbs(text);
    intents.push({ kind: 'highlight', targetTerm: target || undefined, refersToContext, raw: utterance });
  }

  // --- تنقّل لشاشة/قسم ---
  if (hasAny(text, VERBS.navigate)) {
    const target = stripVerbs(text);
    intents.push({ kind: 'navigate_screen', targetTerm: target || undefined, raw: utterance });
    intents.push({ kind: 'open_tab', targetTerm: target || undefined, raw: utterance });
  }

  // --- تسجيل ألم (متعدد الخطوات) ---
  if (severity !== undefined || (hasAny(text, VERBS.save) && (text.includes('الم') || text.includes('وجع') || text.includes('pain') || text.includes('دور') || text.includes('mal')))) {
    const target = stripVerbs(text);
    intents.push({ kind: 'record_pain', value: severity, targetTerm: target || undefined, refersToContext, raw: utterance });
  }

  // --- حفظ عام ---
  if (hasAny(text, VERBS.save) && !intents.some((i) => i.kind === 'record_pain')) {
    intents.push({ kind: 'save', raw: utterance });
  }

  // --- عرض التفاصيل ---
  if (hasAny(text, VERBS.showDetails)) intents.push({ kind: 'show_details', raw: utterance });

  if (!intents.length) intents.push({ kind: 'unknown', raw: utterance });
  return intents;
}

export { findDirection, findSeverity, stripVerbs, hasAny, tokenize };
