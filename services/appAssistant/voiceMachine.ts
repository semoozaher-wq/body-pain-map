// services/appAssistant/voiceMachine.ts
// ============================================================================
// آلة الحالة الصوتية (نقية وقابلة للاختبار) — تُستخدم داخل useAppAssistant.
// الدورة: Listening → Thinking → Speaking → Listening (داخل مكالمة مستمرة)،
// مع دعم المقاطعة (barge-in) والعودة إلى الخمول عند إنهاء المكالمة.
// ============================================================================

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export const VOICE_STATES: VoiceState[] = ['idle', 'listening', 'thinking', 'speaking'];

/** الانتقالات المسموح بها بين حالات المكالمة الصوتية. */
const TRANSITIONS: Record<VoiceState, VoiceState[]> = {
  idle: ['listening', 'thinking', 'speaking'],
  listening: ['thinking', 'idle', 'speaking'],
  thinking: ['speaking', 'listening', 'idle'],
  speaking: ['listening', 'idle', 'thinking'],
};

export function canTransition(from: VoiceState, to: VoiceState): boolean {
  return from === to || TRANSITIONS[from].includes(to);
}

/** الحالة بعد انتهاء النطق: نعود للاستماع داخل مكالمة، أو للخمول خارجها. */
export function afterSpeechEnd(callActive: boolean): VoiceState {
  return callActive ? 'listening' : 'idle';
}

/** الحالة بعد التقاط كلام المستخدم: نفكّر ثم نرد. */
export function afterUserSpeech(): VoiceState {
  return 'thinking';
}

/** الحالة عند بدء الاستماع. */
export function onListenStart(): VoiceState {
  return 'listening';
}
