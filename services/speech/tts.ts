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

/**
 * ينطق النص بصوت طبيعي.
 *
 * الاستدعاء متزامن (مثل Speech.speak) حتى تبقى آلة حالة الجلسة الصوتية كما هي؛
 * اختيار الصوت يستخدم القيمة المخزّنة إن توفّرت (ويُسخّن القائمة للجولة القادمة).
 */
export function speakNatural(text: string, language: string, cb: TtsCallbacks = {}): void {
  const clean = prepareTtsText(text);
  if (!clean) {
    cb.onDone?.();
    return;
  }
  const lang = ttsLangFor(language);
  const prosody = prosodyFor(lang);
  const voice = voiceCache[lang];
  if (!voicesLoaded) void ensureTtsVoices(); // تسخين للجولة القادمة
  Speech.speak(clean, {
    language: lang,
    rate: prosody.rate,
    pitch: prosody.pitch,
    volume: prosody.volume,
    ...(voice ? { voice } : {}),
    onStart: cb.onStart,
    onDone: cb.onDone,
    onStopped: cb.onStopped,
    onError: cb.onError,
  });
}
