// services/aiAssistant/gemini.ts
// ============================================================================
// طبقة الذكاء الاصطناعي الحقيقية (Real LLM layer — Gemini)
// ----------------------------------------------------------------------------
// هذه الطبقة *لا* تتحكم في React/UI مباشرة. وظيفتها الوحيدة:
//   • تستقبل كلام المستخدم + سياق الألم السابق + حالة التطبيق + الصورة (إن وُجدت) + اللغة.
//   • تُرسلها إلى نقطة نهاية خادمية موثوقة (server endpoint) تحمل مفتاح GEMINI_API_KEY.
//   • تُعيد قرارًا موحّدًا (Structured JSON): { intent, reply, confidence, painContext, actions, followUpQuestion }.
// ثم يتولّى services/appAssistant/engine.ts تفسير هذا القرار وتحويله إلى إجراءات
// موجودة فعليًا (AssistantAction) وتنفيذها عبر MainApp.
//
// الأمان:
//   • لا يوجد أي مفتاح API هنا. المفتاح GEMINI_API_KEY يبقى في الخادم فقط (api/assistant.ts).
//   • عند غياب/فشل الخدمة نُعيد null فيسقط النظام تلقائيًا إلى المحرّك القائم على القواعد.
//
// هذا الملف نقي (pure): لا يستورد أي شيء من React Native حتى يمكن استيراده من
// دالة الخادم (api/assistant.ts) أيضًا.
// ============================================================================

import { ACTION_SAFETY } from '../appAssistant/actions';
import type { Lang } from '../appAssistant/types';
import type { PainContext } from './engine';

// ---------------------------------------------------------------------------
// الإعداد (لا أسرار هنا — العنوان فقط، والمفتاح في الخادم)
// ---------------------------------------------------------------------------
const RAW_ENDPOINT = String(process.env.EXPO_PUBLIC_ASSISTANT_AI_ENDPOINT ?? '').trim();
const DISABLED = /^(off|disabled|false|0|none)$/i.test(RAW_ENDPOINT);

/** عنوان نقطة النهاية الخادمية التي تُكلّم Gemini (بلا أي مفتاح). */
export const assistantAiEndpoint = DISABLED ? '' : RAW_ENDPOINT || '/api/assistant';

/** هل طبقة الذكاء الاصطناعي مُهيّأة؟ (افتراضيًا نعم عبر /api/assistant). */
export const isGeminiConfigured = Boolean(assistantAiEndpoint);

/** مهلة قصيرة حتى لا يتعطّل خط الصوت؛ عند تجاوزها نرجع للمحرّك القائم على القواعد. */
export const geminiTimeoutMs = 8000;

// ---------------------------------------------------------------------------
// العقد (Contracts)
// ---------------------------------------------------------------------------
/** نوع إجراء مسموح — يجب أن يكون من الإجراءات الموجودة فعلًا. */
const VALID_ACTION_TYPES = new Set(Object.keys(ACTION_SAFETY));

/**
 * إجراء مُقترَح من Gemini. لا يحمل إحداثيات أبدًا (لا اختراع إحداثيات):
 * يحمل إشارة دلالية (target/direction/screen/tab/value) ويحوّلها محرّك التطبيق
 * إلى AssistantAction حقيقي بإحداثيات من الكتالوج.
 */
export interface GeminiAction {
  /** نوع إجراء موجود فعليًا (set_marker, move_marker, set_view, ...). */
  type: string;
  /** اسم المنطقة/العضو/النقطة/الشاشة/التبويب بالعامية (يُحلّ عبر الكتالوج). */
  target?: string | null;
  /** اتجاه نسبي: above | below | left | right | behind | in_front | near | far | same. */
  direction?: string | null;
  /** مقدار الحركة: little | more | far | near. */
  amount?: string | null;
  /** عرض الجسم: front | back. */
  view?: string | null;
  /** شاشة مقصودة: welcome | body | details | results | history | assistant | healthInfo. */
  screen?: string | null;
  /** تبويب مقصود: muscles | organs | acupressure | naturalRelief | medicalLibrary | drugLookup. */
  tab?: string | null;
  /** قيمة إضافية (شدة/نص بحث/مقدار تكبير). */
  value?: string | number | null;
  /** تسمية بشرية اختيارية. */
  label?: string | null;
}

/** القرار الموحّد الذي تُعيده طبقة Gemini. */
export interface GeminiDecision {
  intent: string;
  reply: string;
  confidence: number;
  painContext: Partial<PainContext> | null;
  actions: GeminiAction[];
  followUpQuestion: string | null;
}

/** سياق مضغوط يُرسَل للنموذج (بلا بيانات حساسة). */
export interface GeminiContext {
  screen?: string | null;
  tab?: string | null;
  view?: string | null;
  sex?: string | null;
  painSeverity?: number | null;
  painMarker?: { x: number; y: number; view: string } | null;
  lastReferenced?: string | null;
  lastReferencedKind?: string | null;
  lastReferencedCoords?: { x: number; y: number; view: string } | null;
  painContext?: PainContext | null;
  /** آخر رسائل المستخدم (للسياق الحواري قصير المدى). */
  recentUserMessages?: string[];
}

export interface GeminiRequest {
  text: string;
  /** صورة كـ data URL (اختياري). */
  image?: string | null;
  language: Lang;
  context?: GeminiContext | null;
}

// ---------------------------------------------------------------------------
// تعليمات النظام (System instruction)
// ---------------------------------------------------------------------------
export const GEMINI_SYSTEM_PROMPT = [
  'أنت "مساعد BodyMap Pain"، مساعد توعية صحية تعليمي داخل تطبيق لخريطة الألم. لست طبيبًا ولا تُقدّم تشخيصًا ولا جرعات دواء.',
  '',
  'المهمة: افهم كلام المستخدم (خاصة العامية المصرية) + السياق السابق + حالة التطبيق + الصورة إن وُجدت، ثم أعد قرارًا موحّدًا بصيغة JSON فقط.',
  '',
  'قواعد اللغة:',
  '- المستخدم قد يتكلم العربية (وبالأخص العامية المصرية) أو الإنجليزية أو الفرنسية. افهم اللغات الثلاث كلها.',
  '- افهم وصف الألم ومناطق الجسم والاتجاهات بكل اللغات الثلاث. أمثلة عربية: "جنبي الشمال بيوجعني"، "فوق شوية"، "تحته"، "ورا شوية"، "لا نفس المكان"، "قصدي الناحية التانية". English: "my left side hurts"، "a bit higher"، "below it"، "a bit back"، "same place". Français: "mon côté gauche me fait mal"، "un peu plus haut"، "en dessous"، "un peu en arrière"، "même endroit".',
  '- اعتمد على السياق السابق ولا تُعِد السؤال عن معلومة قالها المستخدم بالفعل.',
  '- أجب دائمًا بنفس لغة المستخدم (language): ar ⇒ العامية المصرية، en ⇒ English، fr ⇒ Français.',
  '- احتفظ بالسياق (context) عند تبديل اللغة: تغيير لغة المستخدم ليس محادثة جديدة، بل استمرار لنفس المحادثة ونفس علامة الألم.',
  '',
  'القاعدة الأهم:',
  '- إذا كانت كلمات المستخدم كافية لتحديد مكان الألم، فلا تطلب منه أن ينقر على الخريطة. حدّد المنطقة وأصدر إجراءً (set_marker / move_marker) وسيُنفّذه التطبيق على نفس علامة الألم.',
  '',
  'علامة الألم الواحدة (مهم جدًا):',
  '- أول مرة يُحدَّد فيها مكان الألم: استخدم set_marker مع target (اسم المنطقة).',
  '- عند التعديل النسبي على نفس المكان ("فوق شوية"، "على الشمال"، "ورا شوية"): استخدم move_marker مع direction (و amount إن ذُكر) — لا تُنشئ علامة جديدة.',
  '- عند "نفس المكان" أو "سيبه هنا" أو "متتحركه": لا تُصدر set_marker ولا move_marker إطلاقًا.',
  '',
  'الإجراءات المسموحة (استخدم أنواعها فقط، ولا تخترع إجراءات أو إحداثيات):',
  'set_marker (target, view) — move_marker (direction, amount) — set_view (view) — set_sex (value) — navigate (screen) — open_tab (tab) — highlight (target) — clear_highlight — search (value) — filter (value) — zoom (value) — set_severity (value) — back — save — open_last_entry — doctor_summary — reset_context.',
  'قيم screen: welcome, body, details, results, history, assistant, healthInfo.',
  'قيم tab: muscles, organs, acupressure, naturalRelief, medicalLibrary, drugLookup.',
  'قيم direction: above, below, left, right, behind, in_front, near, far, same.',
  'قيم view: front, back.',
  'لا تُخرِج إحداثيات x/y مطلقًا؛ التطبيق يحسبها من الكتالوج.',
  '',
  'الصورة (إن وُجدت):',
  '- استخدمها فقط للمساعدة في تحديد المنطقة التشريحية التي يشير إليها المستخدم أو يصفها.',
  '- لا تدّعِ أبدًا أن الألم نفسه ظاهر في الصورة.',
  '- لا تستنتج مرضًا من الصورة وحدها.',
  '- إن كانت الصورة غير كافية، اسأل سؤالًا قصيرًا طبيعيًا في followUpQuestion.',
  '',
  'السلامة الطبية:',
  '- لا تشخّص ولا تصف دواءً. عند وجود علامة خطر (ألم صدر ضاغط، ضيق نفس، ألم بطني مفاجئ شديد، أعراض عصبية مفاجئة) اذكر الحاجة لتقييم عاجل في reply.',
  '',
  'درجة الثقة (confidence):',
  '- أعِد في حقل confidence رقمًا من 0 إلى 1 يعبّر عن مدى تأكّدك من فهم المكان/الاتجاه/الطلب.',
  '- ثقة عالية (0.85–1.0) عندما يكون المكان أو الاتجاه أو الطلب واضحًا (مثال: «وجع في جنبي الشمال» ⇒ 0.95).',
  '- ثقة منخفضة (0.0–0.45) عندما يكون الكلام مبهمًا أو إشاريًا بلا تحديد (مثال: «وجع هنا كده» ⇒ 0.35)؛ وفي هذه الحالة اسأل سؤالًا توضيحيًا قصيرًا في followUpQuestion ولا تخمّن المكان.',
  '',
  'أعِد JSON فقط بالشكل التالي (بدون أي نص خارجه):',
  '{',
  '  "intent": "locate_pain | move_marker | keep_marker | set_severity | navigate | open_tab | set_view | set_sex | highlight | clear_highlight | search | filter | zoom | save | back | open_last_entry | doctor_summary | general | medical_question | unknown",',
  '  "reply": "نص الرد الطبيعي بلغة المستخدم",',
  '  "confidence": 0.0,',
  '  "painContext": { "painLocation": null, "painDuration": null, "painSeverity": null, "painQuality": [], "radiation": false, "associatedSymptoms": [], "injury": false, "medications": [], "redFlags": [], "aggravatingFactors": [], "relievingFactors": [], "painOnset": null, "userCorrections": [] },',
  '  "actions": [ { "type": "set_marker", "target": "بطني", "view": "front" } ],',
  '  "followUpQuestion": "سؤال متابعة قصير أو null"',
  '}',
  'املأ فقط حقول painContext التي لديك دليل عليها من كلام المستخدم، واترك الباقي فارغًا/null.',
].join('\n');

// ---------------------------------------------------------------------------
// بناء الطلب المُرسَل للخادم
// ---------------------------------------------------------------------------
export function buildUserPayload(req: GeminiRequest): Record<string, unknown> {
  return {
    text: req.text ?? '',
    image: req.image ?? null,
    language: req.language ?? 'ar',
    context: req.context ?? null,
  };
}

// ---------------------------------------------------------------------------
// التحقق من القرار (Normalisation / validation)
// ---------------------------------------------------------------------------
const asString = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
const asNumber = (v: unknown): number | null => {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
const asStringArray = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0).map((x) => x.trim()) : [];

function normalizeAction(raw: unknown): GeminiAction | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const type = asString(o.type);
  if (!type || !VALID_ACTION_TYPES.has(type)) return null;
  const value = typeof o.value === 'number' || typeof o.value === 'string' ? o.value : null;
  return {
    type,
    target: asString(o.target),
    direction: asString(o.direction),
    amount: asString(o.amount),
    view: asString(o.view),
    screen: asString(o.screen),
    tab: asString(o.tab),
    value,
    label: asString(o.label),
  };
}

function normalizePainContext(raw: unknown): Partial<PainContext> | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const out: Partial<PainContext> = {};
  const loc = asString(o.painLocation);
  if (loc) out.painLocation = loc;
  const onset = asString(o.painOnset);
  if (onset) out.painOnset = onset;
  const duration = asString(o.painDuration);
  if (duration) out.painDuration = duration;
  const severity = asNumber(o.painSeverity);
  if (severity !== null) out.painSeverity = Math.max(0, Math.min(10, severity));
  const quality = asStringArray(o.painQuality);
  if (quality.length) out.painQuality = quality;
  if (typeof o.radiation === 'boolean') out.radiation = o.radiation;
  const aggravating = asStringArray(o.aggravatingFactors);
  if (aggravating.length) out.aggravatingFactors = aggravating;
  const relieving = asStringArray(o.relievingFactors);
  if (relieving.length) out.relievingFactors = relieving;
  const associated = asStringArray(o.associatedSymptoms);
  if (associated.length) out.associatedSymptoms = associated;
  if (typeof o.injury === 'boolean') out.injury = o.injury;
  const meds = asStringArray(o.medications);
  if (meds.length) out.medications = meds;
  const redFlags = asStringArray(o.redFlags);
  if (redFlags.length) out.redFlags = redFlags;
  const corrections = asStringArray(o.userCorrections);
  if (corrections.length) out.userCorrections = corrections;
  return Object.keys(out).length ? out : null;
}

/**
 * يتحقق من قرار النموذج ويُعيده منظّمًا، أو null إن كان غير صالح.
 * أي إجراء بنوع غير موجود يُسقَط (لا اختراع إجراءات).
 */
export function normalizeDecision(raw: unknown): GeminiDecision | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  const reply = asString(obj.reply) ?? '';
  const followUpQuestion = asString(obj.followUpQuestion);
  const intent = asString(obj.intent) ?? 'unknown';
  const confidenceRaw = asNumber(obj.confidence);
  const confidence = confidenceRaw === null ? 0.5 : Math.max(0, Math.min(1, confidenceRaw));
  const actions = Array.isArray(obj.actions)
    ? obj.actions.map(normalizeAction).filter((a): a is GeminiAction => a !== null)
    : [];
  const painContext = normalizePainContext(obj.painContext);
  if (!reply && !followUpQuestion && actions.length === 0) return null;
  return { intent, reply, confidence, painContext, actions, followUpQuestion };
}

// ---------------------------------------------------------------------------
// دمج السياق الطبي: معلومة Gemini الجديدة تغلب، والباقي يُحفظ
// ---------------------------------------------------------------------------
export function mergePainContext(base: PainContext | null | undefined, partial: Partial<PainContext> | null | undefined): PainContext {
  const b: Partial<PainContext> = base ?? {};
  const p: Partial<PainContext> = partial ?? {};
  const uniq = (arr: string[]): string[] => [...new Set(arr.filter(Boolean))];
  return {
    painLocation: p.painLocation ?? b.painLocation ?? null,
    painLocationLabel: b.painLocationLabel ?? null,
    painOnset: p.painOnset ?? b.painOnset ?? null,
    painDuration: p.painDuration ?? b.painDuration ?? null,
    painSeverity: p.painSeverity ?? b.painSeverity ?? null,
    painQuality: uniq([...(p.painQuality ?? []), ...(b.painQuality ?? [])]),
    radiation: p.radiation ?? b.radiation ?? false,
    aggravatingFactors: uniq([...(p.aggravatingFactors ?? []), ...(b.aggravatingFactors ?? [])]),
    relievingFactors: uniq([...(p.relievingFactors ?? []), ...(b.relievingFactors ?? [])]),
    associatedSymptoms: uniq([...(p.associatedSymptoms ?? []), ...(b.associatedSymptoms ?? [])]),
    injury: p.injury ?? b.injury ?? false,
    medications: uniq([...(p.medications ?? []), ...(b.medications ?? [])]),
    redFlags: uniq([...(p.redFlags ?? []), ...(b.redFlags ?? [])]),
    userCorrections: uniq([...(p.userCorrections ?? []), ...(b.userCorrections ?? [])]),
  };
}

// ---------------------------------------------------------------------------
// استدعاء نقطة النهاية الخادمية (بلا أي مفتاح في العميل)
// ---------------------------------------------------------------------------
/**
 * يطلب قرارًا من طبقة Gemini عبر الخادم الوسيط.
 * يُعيد null عند أي فشل/عدم تهيئة ⇒ يسقط المستدعي إلى المحرّك القائم على القواعد.
 */
export async function requestGeminiDecision(req: GeminiRequest): Promise<GeminiDecision | null> {
  if (!isGeminiConfigured) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), geminiTimeoutMs);
  try {
    const res = await fetch(assistantAiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify(buildUserPayload(req)),
    });
    if (!res.ok) return null;
    const payload: unknown = await res.json();
    const raw = payload && typeof payload === 'object' && 'decision' in (payload as Record<string, unknown>)
      ? (payload as Record<string, unknown>).decision
      : payload;
    return normalizeDecision(raw);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
