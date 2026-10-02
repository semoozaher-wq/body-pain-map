'use strict';

// services/settings/core.js
// ============================================================================
// منطق نقّي (pure) لإعدادات التطبيق — قابل للاختبار عبر node --test.
// ----------------------------------------------------------------------------
// لا يعتمد على React ولا AsyncStorage. الطبقة التي تلمس التخزين في
// hooks/useSettings.ts (نفس نمط usePainHistory/useConversations).
// البلوبرنت #14: لغة/صوت/سرعة/ثيم/خصوصية/سجل المحادثات/تنبيهات طبية/معلومات.
// ============================================================================

/** مفتاح التخزين المحلي للإعدادات. */
const SETTINGS_STORAGE_KEY = 'bodymap-settings-v1';

/** القيم الافتراضية للإعدادات. */
const DEFAULT_SETTINGS = Object.freeze({
  voiceEnabled: true,
  voiceRate: 1,
  autoSpeakReplies: false,
  medicalAlerts: true,
});

/** حدود سرعة النطق المسموح بها. */
const VOICE_RATE_MIN = 0.6;
const VOICE_RATE_MAX = 1.4;

/** يقيّد سرعة النطق ضمن الحدود ويقرّبها لخانتين عشريتين. */
function clampVoiceRate(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.voiceRate;
  const clamped = Math.min(VOICE_RATE_MAX, Math.max(VOICE_RATE_MIN, n));
  return Math.round(clamped * 100) / 100;
}

function toBool(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * يدمج إعدادات محفوظة (قد تكون ناقصة/تالفة) مع القيم الافتراضية،
 * فيضمن وجود كل المفاتيح دائمًا وبأنواع صحيحة.
 */
function mergeSettings(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    voiceEnabled: toBool(source.voiceEnabled, DEFAULT_SETTINGS.voiceEnabled),
    voiceRate: clampVoiceRate(source.voiceRate),
    autoSpeakReplies: toBool(source.autoSpeakReplies, DEFAULT_SETTINGS.autoSpeakReplies),
    medicalAlerts: toBool(source.medicalAlerts, DEFAULT_SETTINGS.medicalAlerts),
  };
}

module.exports = {
  SETTINGS_STORAGE_KEY,
  DEFAULT_SETTINGS,
  VOICE_RATE_MIN,
  VOICE_RATE_MAX,
  clampVoiceRate,
  mergeSettings,
};
