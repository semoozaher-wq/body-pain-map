// services/speech/ttsVoice.ts
// ============================================================================
// منطق اختيار الصوت الطبيعي (Natural TTS voice selection) — منطق نقي قابل للاختبار.
// ----------------------------------------------------------------------------
// لا يعتمد على expo-speech حتى يمكن اختباره في Node. الغلاف الذي يستدعي
// Speech.speak موجود في services/speech/tts.ts.
//
// الهدف: جعل نطق المساعد طبيعيًا قدر الإمكان (شبيه بأصوات Gemini/Neural) عبر:
//   • اختيار أفضل صوت متاح للغة (تفضيل الأصوات العصبية/الطبيعية/المحسّنة)،
//   • ضبط النبرة (pitch) والسرعة (rate) على قيم طبيعية غير آلية،
//   • تنظيف النص قبل النطق (إزالة الماركداون/الإيموجي/الروابط).
// ============================================================================

/** وصف مختصر لصوت (مجموعة فرعية بنيوية من Voice/WebVoice في expo-speech). */
export interface VoiceLike {
  identifier: string;
  name: string;
  language: string;
  localService?: boolean;
  isDefault?: boolean;
  quality?: string;
}

/** لغة النطق (BCP-47) حسب لغة الواجهة. */
export function ttsLangFor(language: string): string {
  return language === 'en' ? 'en-US' : language === 'fr' ? 'fr-FR' : 'ar-EG';
}

/** المقطع اللغوي الأساسي: 'ar-EG' -> 'ar'. */
function primarySubtag(tag: string): string {
  return String(tag || '').toLowerCase().replace('_', '-').split('-')[0];
}

// كلمات مفتاحية في اسم الصوت تدل على جودة/طبيعية أعلى (موجبة) أو صوت آلي (سالبة).
const NAME_SCORES: Array<[RegExp, number]> = [
  [/neural/i, 60],
  [/wavenet|studio|journey|polyglot/i, 58],
  [/natural/i, 55],
  [/premium|enhanced/i, 50],
  [/siri/i, 45],
  [/google/i, 40],
  [/microsoft/i, 20],
  [/eloquence|espeak|compact|festival|pico/i, -60],
];

/**
 * يقيّم مدى ملاءمة صوت للغة المطلوبة. أعلى = أنسب/أكثر طبيعية.
 * أي صوت بلغة مختلفة يُستبعد (قيمة سالبة كبيرة) حتى لا يُقرأ النص بلغة غلط.
 */
export function scoreVoice(voice: VoiceLike, lang: string): number {
  const want = String(lang || '').toLowerCase().replace('_', '-');
  const wantPrimary = primarySubtag(want);
  const have = String(voice?.language || '').toLowerCase().replace('_', '-');
  const havePrimary = primarySubtag(have);
  if (!havePrimary || havePrimary !== wantPrimary) return -1000;
  let score = 0;
  if (have === want) score += 100; // نفس المنطقة بالظبط
  else if (have.startsWith(wantPrimary + '-')) score += 55; // نفس اللغة، منطقة أخرى
  else score += 30;
  const name = String(voice?.name || '');
  for (const [re, pts] of NAME_SCORES) if (re.test(name)) score += pts;
  if (voice?.localService === false) score += 15; // الأصوات السحابية عادةً أجود
  if (voice?.isDefault) score += 3;
  return score;
}

/** يختار أفضل صوت للغة، أو null إن لم يوجد صوت بنفس اللغة. */
export function pickBestVoice(voices: VoiceLike[], lang: string): VoiceLike | null {
  let best: VoiceLike | null = null;
  let bestScore = -Infinity;
  for (const v of voices || []) {
    const s = scoreVoice(v, lang);
    if (s > bestScore) {
      bestScore = s;
      best = v;
    }
  }
  return bestScore > 0 ? best : null;
}

/** نبرة/سرعة طبيعية غير آلية لكل لغة. */
export function prosodyFor(lang: string): { rate: number; pitch: number; volume: number } {
  const p = primarySubtag(lang);
  if (p === 'ar') return { rate: 0.95, pitch: 1.0, volume: 1.0 };
  if (p === 'fr') return { rate: 0.98, pitch: 1.0, volume: 1.0 };
  return { rate: 1.0, pitch: 1.0, volume: 1.0 };
}

// إيموجي ورموز مصوّرة + محددات الاتجاه/الربط (لا تُنطق، فتُزال).
const EMOJI =
  /[\u{1F300}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}]/gu;

/**
 * ينظّف النص قبل النطق: ماركداون/إيموجي/روابط → كلام طبيعي.
 * (لا يغيّر المعنى، فقط ما لا يُنطق بشكل مفهوم.)
 */
export function prepareTtsText(text: string): string {
  let s = String(text ?? '');
  s = s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'); // [label](url) -> label
  s = s.replace(/https?:\/\/\S+/gi, ' '); // روابط عارية
  s = s.replace(EMOJI, ' ');
  s = s.replace(/[`*_~#>]+/g, ' '); // ماركداون
  s = s.replace(/^\s*[-•]\s+/gm, ' '); // نقاط القوائم
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}
