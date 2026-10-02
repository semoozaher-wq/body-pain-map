// services/speech/tts.ts
// ============================================================================
// غلاف النطق الطبيعي (Natural TTS wrapper) فوق expo-speech.
// ----------------------------------------------------------------------------
// يختار أفضل صوت متاح للغة مرة واحدة ويخزّنه، ويطبّق نبرة/سرعة طبيعية، وينظّف
// النص قبل النطق — فيصبح نطق المساعد طبيعيًا (شبيه بأصوات Gemini/Neural) بدل
// الصوت الآلي الافتراضي.
//
// مهم: كل الاستدعاءات الحالية (Speech.stop / onDone / onStopped / onError) تبقى
// كما هي حتى لا يتغيّر سلوك آلة حالة الجلسة الصوتية (Voice/STT/TTS سليم كما هو).
// ============================================================================

import * as Speech from 'expo-speech';
import {
  pickBestVoice,
  prepareTtsText,
  prosodyFor,
  ttsLangFor,
  type VoiceLike,
} from './ttsVoice';

const LANGS = ['ar-EG', 'en-US', 'fr-FR'] as const;

/** أفضل صوت (identifier) لكل لغة، يُملأ مرة واحدة. */
const voiceCache: Record<string, string | undefined> = {};
let voicesLoaded = false;
let loading: Promise<void> | null = null;

/**
 * يحمّل قائمة الأصوات مرة واحدة ويختار الأفضل لكل لغة.
 * آمن تمامًا: أي فشل يُتجاهل ونبقى على صوت النظام الافتراضي (لا يرمي أخطاء).
 */
export async function ensureTtsVoices(): Promise<void> {
  if (voicesLoaded) return;
  if (loading) return loading;
  loading = (async () => {
    try {
      const voices = (await Speech.getAvailableVoicesAsync()) as unknown as VoiceLike[];
      for (const lang of LANGS) {
        const best = pickBestVoice(voices, lang);
        if (best) voiceCache[lang] = best.identifier;
      }
      voicesLoaded = true;
    } catch {
      // نبقى على صوت النظام الافتراضي.
    } finally {
      loading = null;
    }
  })();
  return loading;
}

export interface TtsCallbacks {
  onStart?: () => void;
  onDone?: () => void;
  onStopped?: () => void;
  onError?: (error?: unknown) => void;
}

/** خيارات إضافية للنطق (سرعة قابلة للضبط من الإعدادات — البلوبرنت #14). */
export interface TtsOptions {
  /** سرعة النطق المطلوبة (تُقيَّد ضمن 0.5 - 1.6). إن غابت تُستخدم السرعة الطبيعية. */
  rate?: number;
}

/** يقيّد سرعة النطق ضمن نطاق آمن لتفادي صوت غير مفهوم. */
function clampRate(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(1.6, Math.max(0.5, value));
}

/**
 * ينطق النص بصوت طبيعي.
 *
 * الاستدعاء متزامن (مثل Speech.speak) حتى تبقى آلة حالة الجلسة الصوتية كما هي؛
 * اختيار الصوت يستخدم القيمة المخزّنة إن توفّرت (ويُسخّن القائمة للجولة القادمة).
 */
export function speakNatural(text: string, language: string, cb: TtsCallbacks = {}, options: TtsOptions = {}): void {
  const clean = prepareTtsText(text);
  if (!clean) {
    cb.onDone?.();
    return;
  }
  const lang = ttsLangFor(language);
  const prosody = prosodyFor(lang);
  const rate = clampRate(options.rate, prosody.rate);
  const voice = voiceCache[lang];
  if (!voicesLoaded) void ensureTtsVoices(); // تسخين للجولة القادمة
  Speech.speak(clean, {
    language: lang,
    rate,
    pitch: prosody.pitch,
    volume: prosody.volume,
    ...(voice ? { voice } : {}),
    onStart: cb.onStart,
    onDone: cb.onDone,
    onStopped: cb.onStopped,
    onError: cb.onError,
  });
}
