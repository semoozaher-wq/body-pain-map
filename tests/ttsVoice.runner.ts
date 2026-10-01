// tests/ttsVoice.runner.ts
// ============================================================================
// Regression runner for the NATURAL VOICE (TTS) fix.
// ----------------------------------------------------------------------------
// Emits a single JSON object on stdout so tests/ttsVoice.test.cjs can assert on
// it via `node --test`. It drives the REAL pure unit (no re-implementation):
//   • services/speech/ttsVoice.ts (scoreVoice, pickBestVoice, prosodyFor,
//     prepareTtsText, ttsLangFor)
// ============================================================================

import {
  scoreVoice,
  pickBestVoice,
  prosodyFor,
  prepareTtsText,
  ttsLangFor,
  type VoiceLike,
} from '../services/speech/ttsVoice';

const voices: VoiceLike[] = [
  { identifier: 'ar-eg-espeak', name: 'eSpeak Arabic', language: 'ar-EG', localService: true },
  { identifier: 'ar-eg-google', name: 'Google العربية', language: 'ar-EG', localService: false },
  { identifier: 'ar-sa-natural', name: 'Microsoft Natural Arabic', language: 'ar-SA', localService: false },
  { identifier: 'en-us-google', name: 'Google US English', language: 'en-US', localService: false },
  { identifier: 'en-us-compact', name: 'English Compact', language: 'en_US', localService: true },
  { identifier: 'fr-fr-siri', name: 'Siri Voice (French)', language: 'fr-FR', localService: false },
  { identifier: 'de-de-google', name: 'Google Deutsch', language: 'de-DE', localService: false },
];

const out = {
  scores: {
    robotic: scoreVoice(voices[0], 'ar-EG'),
    google: scoreVoice(voices[1], 'ar-EG'),
    naturalOtherRegion: scoreVoice(voices[2], 'ar-EG'),
    wrongLang: scoreVoice(voices[6], 'ar-EG'),
  },
  picks: {
    ar: pickBestVoice(voices, 'ar-EG')?.identifier ?? null,
    en: pickBestVoice(voices, 'en-US')?.identifier ?? null,
    fr: pickBestVoice(voices, 'fr-FR')?.identifier ?? null,
    none: pickBestVoice([voices[6]], 'ar-EG')?.identifier ?? null,
    empty: pickBestVoice([], 'ar-EG')?.identifier ?? null,
  },
  prosody: {
    ar: prosodyFor('ar-EG'),
    en: prosodyFor('en-US'),
    fr: prosodyFor('fr-FR'),
  },
  prepared: {
    markdown: prepareTtsText('**ألم** شديد في `الرجل`'),
    emoji: prepareTtsText('عندك ألم؟ 😟🔥'),
    url: prepareTtsText('شوف https://example.com/very/long/path دلوقتي'),
    link: prepareTtsText('اقرأ [التعليمات](https://x.com) الأول'),
    bullets: prepareTtsText('- نقطة\n- نقطة تانية'),
    plain: prepareTtsText('عندي ألم في الرجل'),
  },
  ttsLang: {
    ar: ttsLangFor('ar'),
    en: ttsLangFor('en'),
    fr: ttsLangFor('fr'),
    other: ttsLangFor('xx'),
  },
};

console.log(JSON.stringify(out));
