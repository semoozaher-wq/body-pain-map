// services/settings/core.d.ts
// تعريفات TypeScript لمنطق إعدادات التطبيق النقي (services/settings/core.js).

export const SETTINGS_STORAGE_KEY: string;

export interface AppSettings {
  /** تشغيل/إيقاف الميزات الصوتية كليًا (الاستماع والنطق). */
  voiceEnabled: boolean;
  /** سرعة النطق (0.6 - 1.4). */
  voiceRate: number;
  /** نطق ردود المساعد تلقائيًا. */
  autoSpeakReplies: boolean;
  /** إظهار التنبيهات والتذكيرات الطبية. */
  medicalAlerts: boolean;
}

export const DEFAULT_SETTINGS: Readonly<AppSettings>;
export const VOICE_RATE_MIN: number;
export const VOICE_RATE_MAX: number;

export function clampVoiceRate(value: unknown): number;
export function mergeSettings(raw: unknown): AppSettings;
