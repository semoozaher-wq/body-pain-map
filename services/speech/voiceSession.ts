// services/speech/voiceSession.ts
// ============================================================================
// قفل الجلسة الصوتية المفردة (Single voice-session lock)
// ----------------------------------------------------------------------------
// السبب الجذري الذي يعالجه
//   كان مساران صوتيان يعملان في نفس الوقت:
//     • screens/AssistantScreen.tsx        (شاشة المساعد الكامل)
//     • hooks/useAppAssistant.ts           (المساعد العائم، يبقى mounted دائمًا)
//   كلاهما يسجّل useSpeechRecognitionEvents('start'|'end'|'error'|'result')، و
//   expo's useEventListener يضيف listener على نفس الوحدة الأصلية (singleton)
//   عبر addListener، فيصل كل حدث native إلى الاثنين معًا ⇒ جولتان وردّان
//   واستدعاءان للمحرّك/الإجراءات لنفس الجملة.
//
//   هذا القفل يجعل «من يملك الميكروفون الآن» حقيقة واحدة على مستوى التطبيق:
//   لا يمكن لأكثر من مسار واحد أن يبدأ/يعالج جلسة تعرّف في نفس الوقت.
//
//   وحدة نقية بلا DOM ولا مؤقتات ⇒ قابلة للاختبار مباشرة.
// ============================================================================

let currentOwner: string | null = null;

/**
 * محاولة امتلاك جلسة الاستماع. تنجح إن لم يكن هناك مالك، أو إن كان المالك هو
 * نفس المعرّف (إعادة تشغيل داخل نفس الجلسة). تفشل إن كان مسار آخر يملكها.
 */
export function claimVoiceSession(owner: string): boolean {
  if (currentOwner && currentOwner !== owner) return false;
  currentOwner = owner;
  return true;
}

/** تحرير الجلسة إن كان هذا المعرّف هو المالك الحالي. */
export function releaseVoiceSession(owner: string): void {
  if (currentOwner === owner) currentOwner = null;
}

/** هل هذا المعرّف هو المالك الحالي للميكروفون؟ */
export function isVoiceSessionOwner(owner: string): boolean {
  return currentOwner === owner;
}

/** المالك الحالي (أو null). مفيد للتشخيص والاختبار. */
export function currentVoiceSessionOwner(): string | null {
  return currentOwner;
}

/** إعادة الضبط الكاملة (للاستخدام في الاختبارات فقط). */
export function __resetVoiceSessionForTests(): void {
  currentOwner = null;
}
