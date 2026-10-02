// hooks/useAppAssistant.ts
// ============================================================================
// متحكّم المساعد المركزي (App-wide Assistant Controller)
// ----------------------------------------------------------------------------
// يدير جولة الحوار: يستقبل كلام المستخدم (كتابة/صوت)، يستدعي المحرّك، ينفّذ
// الإجراءات الآمنة عبر onAction، ويحتفظ بالإجراءات الحسّاسة للتأكيد.
// يحتوي آلة حالة صوتية حقيقية: استماع → تفكير → تحدّث → استماع (متابعة تلقائية)،
// مع مقاطعة (barge-in)، كتم، مكبّر صوت، إنهاء المكالمة، ومعالجة أخطاء الميكروفون/الشبكة.
// لا يعرف تفاصيل الشاشات — يتعامل فقط مع AppState + onAction (فصل تام).
//
// v2 (voice-pipeline fix): كل منطق النصّ الصوتي (live/committed/pending + مهلة
// الصمت) انتقل إلى وحدة واحدة قابلة للاختبار services/speech/turnGate.ts،
// لضمان أن كل جملة تُنتج جولة واحدة فقط (منع الإرسال المزدوج).
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { SpeechRecognitionModule, useSpeechRecognitionEvents } from '../services/speechRecognition';
import { createWebRecognizer, webSpeechSupported, isLikelyInAppBrowser, type SpeechSnapshot, type WebRecognizer } from '../services/speech/webSpeech';
import { voiceLog } from '../services/speech/voiceLog';
import { normalizeSpeechText } from '../services/speech/arabicSpeech';
import { speakNatural, ensureTtsVoices } from '../services/speech/tts';
import { createTurnGate, type TurnGate } from '../services/speech/turnGate';
import { claimVoiceSession, releaseVoiceSession, isVoiceSessionOwner } from '../services/speech/voiceSession';
import { interpretAsync } from '../services/appAssistant/engine';
import type { AppState, AssistantAction, AssistantTurn, Lang } from '../services/appAssistant/types';
import { afterSpeechEnd, type VoiceState } from '../services/appAssistant/voiceMachine';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  turn?: AssistantTurn;
}

/** مراحل آلة الحالة الصوتية (مُعرّفة في وحدة نقية قابلة للاختبار). */
export type { VoiceState } from '../services/appAssistant/voiceMachine';

const speechLang = (language: string): string =>
  language === 'en' ? 'en-US' : language === 'fr' ? 'fr-FR' : 'ar-EG';

let msgSeq = 0;
const nextId = () => `am-${Date.now()}-${msgSeq++}`;

// هوية هذا المسار الصوتي في قفل الجلسة المفردة (services/speech/voiceSession).
const VOICE_OWNER = 'global';

export interface UseAppAssistantOptions {
  /** يقرأ حالة التطبيق الحالية عند كل جولة. */
  getState: () => AppState;
  /** ينفّذ إجراءً واحدًا على التطبيق. */
  onAction: (action: AssistantAction) => void;
  /** يُبلّغ المضيف بكل جولة مكتملة (لتتبّع النمط/السياق دون تغيير السلوك). */
  onTurn?: (turn: AssistantTurn) => void;
  language: Lang;
  /** نطق الردود تلقائيًا. */
  autoSpeak?: boolean;
  /**
   * هل هذا المسار هو السطح النشط الآن؟ عندما false (مثلًا المساعد العائم
   * مخفي أثناء عرض AssistantScreen) يُصبح المسار خاملًا تمامًا: لا يعالج أي
   * حدث تعرّف، ولا يبدأ استماعًا، ويحرّر قفل الجلسة. هذا يضمن ألّا يعمل أكثر
   * من مسار صوتي واحد في نفس الوقت.
   */
  enabled?: boolean;
}

export function useAppAssistant({ getState, onAction, onTurn, language, autoSpeak = false, enabled = true }: UseAppAssistantOptions) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [pending, setPending] = useState<AssistantAction[]>([]);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [callActive, setCallActive] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speakerOn, setSpeakerOn] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const webRecognizerRef = useRef<WebRecognizer | null>(null);
  const noResultTimerRef = useRef<any>(null);
  const startListeningRef = useRef<() => void>(() => {});
  const stopListeningRef = useRef<() => void>(() => {});
  // TurnGate: المصدر الوحيد للحقيقة في تتبّع النصّ الصوتي (يمنع الإرسال المزدوج).
  const gateRef = useRef<TurnGate | null>(null);
  const sendRef = useRef<(text: string) => void>(() => {});
  const gotResultRef = useRef(false);
  // السياق الطبي المُجمَّع بين الرسائل (spec #4d): نمرّره للمحرّك في كل جولة حتى يبني
  // على ما قاله المستخدم سابقًا بدل أن يعيد السؤال.
  const painContextRef = useRef<any>(null);
  // مهلة الصمت التي نعتبرها نهاية جولة المستخدم (تمنحه وقتًا طبيعيًا للكلام قبل الرد).
  const TURN_SILENCE_MS = 1500;
  const NO_RESULT_WATCHDOG_MS = 7000;
  const languageRef = useRef(language);
  languageRef.current = language;
  const mutedRef = useRef(muted);
  mutedRef.current = muted;
  const speakerRef = useRef(speakerOn);
  speakerRef.current = speakerOn;
  const callActiveRef = useRef(callActive);
  callActiveRef.current = callActive;
  const voiceStateRef = useRef(voiceState);
  voiceStateRef.current = voiceState;
  const listeningRef = useRef(listening);
  listeningRef.current = listening;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  // B2a (report fix): true while the assistant is speaking (TTS_SPEAKING). نمنع
  // إعادة تشغيل الميكروفون (STT) أثناء النطق لمنع تراكب الصوتين (صدى/تغذية راجعة).
  const speakingRef = useRef(false);

  // --- إنشاء/جلب الـ TurnGate (مرة واحدة) ---
  const getGate = useCallback((): TurnGate => {
    if (!gateRef.current) {
      gateRef.current = createTurnGate({
        silenceMs: TURN_SILENCE_MS,
        onInterim: (text) => setInterim(text),
        onTurn: (text) => {
          sendRef.current(text);
          if (!callActiveRef.current) stopListeningRef.current?.();
        },
        onEmpty: () => {
          if (!callActiveRef.current) stopListeningRef.current?.();
        },
        onLog: (stage, data) => voiceLog(stage, data),
      });
    }
    return gateRef.current;
  }, []);

  // --- نهاية النطق: نعود للاستماع داخل المكالمة، أو للخمول خارجها ---
  const finishSpeech = useCallback(() => {
    speakingRef.current = false;
    setSpeakingId(null);
    const next = afterSpeechEnd(callActiveRef.current);
    setVoiceState(next);
    // متابعة تلقائية: بعد انتهاء الرد نرجع للاستماع (فقط إن لم يكن الميكروفون يعمل بالفعل).
    if (next === 'listening') {
      setTimeout(() => {
        if (callActiveRef.current && !listeningRef.current) startListeningRef.current();
      }, 200);
    }
  }, []);

  // --- نطق الردود (يحترم الكتم) ---
  const speak = useCallback((text: string, id?: string) => {
    if (mutedRef.current || !speakerRef.current) { finishSpeech(); return; }
    try {
      Speech.stop();
      // B2a (report fix): أوقف الاستماع (STT) فورًا عند بدء النطق (TTS_SPEAKING)
      // لمنع تراكب الميكروفون مع صوت المساعد (صدى/تغذية راجعة). تُبقى جلسة الصوت
      // مفتوحة، ويُعاد الاستماع تلقائيًا في finishSpeech بعد انتهاء النطق.
      speakingRef.current = true;
      try {
        if (Platform.OS === 'web') webRecognizerRef.current?.stop?.();
        else SpeechRecognitionModule?.stop?.();
      } catch {}
      setListening(false);
      if (id) setSpeakingId(id);
      setVoiceState('speaking');
      // نطق طبيعي: أفضل صوت متاح للغة + نبرة/سرعة طبيعية (بدل الصوت الآلي الافتراضي).
      speakNatural(text, languageRef.current, {
        onDone: finishSpeech,
        onStopped: finishSpeech,
        onError: finishSpeech,
      });
    } catch {
      finishSpeech();
    }
  }, [finishSpeech]);

  // --- تنفيذ إجراءات جولة ---
  const runTurn = useCallback(
    (turn: AssistantTurn) => {
      for (const action of turn.actions) {
        // تغيير الموضوع/محادثة جديدة: نفرّغ السياق الطبي المحلي أيضًا.
        if (action.type === 'reset_context') painContextRef.current = null;
        onAction(action);
      }
      if (turn.painContext) painContextRef.current = turn.painContext;
      else if (turn.mode === 'medical' && turn.medical?.painContext) painContextRef.current = turn.medical.painContext;
      if (turn.needsConfirmation) setPending(turn.pendingConfirmation);
      else setPending([]);
    },
    [onAction],
  );

  // --- إرسال رسالة نصية/صوتية (نفس المسار للكتابة والصوت ⇒ سياق متصل) ---
  const send = useCallback(
    async (text: string): Promise<AssistantTurn | null> => {
      const trimmed = normalizeSpeechText(text).trim();
      if (!trimmed) return null;
      setError(null);
      setVoiceState('thinking');
      const state = getState();
      const recentUserMessages = messages
        .filter((message) => message.role === 'user')
        .slice(-4)
        .map((message) => message.text)
        .filter(Boolean);
      // المسار الموحّد: Gemini (نصّ + سياق + لغة) ثم محرّك القواعد كطبقة تفسير/احتياط.
      // نمرّر نفس السياق الطبي + آخر الرسائل إلى Gemini حتى لا يرى النموذج جولة
      // جديدة كأنها محادثة مستقلة عن الجولة السابقة.
      const turn = await interpretAsync(trimmed, state, {
        previousContext: painContextRef.current ?? undefined,
        recentUserMessages,
      });
      const userMsg: AssistantMessage = { id: nextId(), role: 'user', text: trimmed };
      const botMsg: AssistantMessage = { id: nextId(), role: 'assistant', text: turn.reply[state.language], turn };
      setMessages((prev) => [...prev, userMsg, botMsg]);
      runTurn(turn);
      onTurn?.(turn);
      voiceLog('assistant-response', { reply: turn.reply[state.language]?.slice(0, 80), mode: turn.mode });
      if (autoSpeak || callActiveRef.current) speak(turn.reply[state.language], botMsg.id);
      else setVoiceState(afterSpeechEnd(callActiveRef.current));
      return turn;
    },
    [getState, runTurn, onTurn, autoSpeak, speak, messages],
  );
  sendRef.current = send;

  // --- تأكيد الإجراءات الحسّاسة المعلّقة ---
  const confirmPending = useCallback(() => {
    if (!pending.length) return;
    for (const action of pending) onAction({ ...action, requiresConfirmation: false });
    setPending([]);
    const botMsg: AssistantMessage = { id: nextId(), role: 'assistant', text: 'تم التنفيذ.' };
    setMessages((prev) => [...prev, botMsg]);
  }, [pending, onAction]);

  const cancelPending = useCallback(() => setPending([]), []);

  // --- أحداث التعرّف على الكلام (المسار الأصلي/Expo) ---
  useSpeechRecognitionEvents('start', () => {
    if (!enabledRef.current || !isVoiceSessionOwner(VOICE_OWNER)) return;
    voiceLog('mic-start', { platform: 'native' });
    setListening(true);
    setVoiceState('listening');
  });
  useSpeechRecognitionEvents('end', () => {
    if (!enabledRef.current || !isVoiceSessionOwner(VOICE_OWNER)) return;
    voiceLog('mic-end', { platform: 'native' });
    setListening(false);
    // لا نُهدر النص: نُفرّغ أي جولة معلّقة عند نهاية الجلسة (نهاية الكلام).
    getGate().flush();
    setInterim('');
    if (voiceStateRef.current === 'listening' && !callActiveRef.current) setVoiceState('idle');
  });
  useSpeechRecognitionEvents('error', (event: any) => {
    if (!enabledRef.current || !isVoiceSessionOwner(VOICE_OWNER)) return;
    voiceLog('speech-error', { platform: 'native', code: event?.error });
    setListening(false);
    setInterim('');
    setError(event?.error ?? 'speech-error');
    setVoiceState(afterSpeechEnd(callActiveRef.current));
  });
  useSpeechRecognitionEvents('result', (event: any) => {
    if (!enabledRef.current || !isVoiceSessionOwner(VOICE_OWNER)) return;
    const transcript: string = event?.results?.[0]?.transcript ?? '';
    if (!transcript) return;
    const speechText = normalizeSpeechText(transcript);
    if (!speechText) return;
    voiceLog('speech-result', { platform: 'native', transcript, normalized: speechText, isFinal: !!event?.isFinal });
    // مقاطعة: لو المساعد بيتكلم والمستخدم بدأ يتكلم، نوقف النطق فورًا.
    if (voiceStateRef.current === 'speaking') {
      try { Speech.stop(); } catch {}
      setSpeakingId(null);
    }
    if (event?.isFinal) {
      // كل نتيجة نهائية تمرّ عبر TurnGate ⇒ جولة واحدة لكل جملة.
      getGate().onFinal(speechText);
    } else {
      setInterim(speechText);
    }
  });

  // --- تشغيل/إيقاف الاستماع ---
  const startListening = useCallback(async () => {
    setError(null);
    try {
      if (Platform.OS === 'web') {
        if (listeningRef.current) return;
        if (!webSpeechSupported()) {
          voiceLog('mic-start', { supported: false, inApp: isLikelyInAppBrowser() });
          setError(isLikelyInAppBrowser() ? 'in-app-browser' : 'no-speech-api');
          return;
        }
        // قفل الجلسة: مسار واحد فقط يملك الميكروفون في أي لحظة.
        if (!claimVoiceSession(VOICE_OWNER)) { voiceLog('mic-session-busy', { platform: 'web' }); return; }
        // جولة جديدة: نُصفّر الـ TurnGate والمؤشرات.
        getGate().reset();
        gotResultRef.current = false;
        const recognizer = createWebRecognizer(
          { lang: speechLang(languageRef.current), continuous: callActiveRef.current, interimResults: true, maxAlternatives: 3 },
          {
            log: (stage, data) => voiceLog(stage, data),
            onStart: () => {
              setListening(true);
              setVoiceState('listening');
              // حارس: لو لم تصل أي نتيجة خلال مهلة، نسجّل ذلك بوضوح (يساعد في تشخيص WebView).
              if (noResultTimerRef.current) clearTimeout(noResultTimerRef.current);
              noResultTimerRef.current = setTimeout(() => {
                if (!gotResultRef.current) {
                  voiceLog('no-speech-result-watchdog', { afterMs: NO_RESULT_WATCHDOG_MS, inApp: isLikelyInAppBrowser() });
                }
              }, NO_RESULT_WATCHDOG_MS);
            },
            onResult: (snap: SpeechSnapshot) => {
              gotResultRef.current = true;
              if (noResultTimerRef.current) { clearTimeout(noResultTimerRef.current); noResultTimerRef.current = null; }
              // مقاطعة: لو المساعد بيتكلم والمستخدم بدأ يتكلم، نوقف النطق فورًا.
              if (voiceStateRef.current === 'speaking') {
                try { Speech.stop(); } catch {}
                setSpeakingId(null);
              }
              getGate().onSnapshot(snap);
            },
            onError: (code) => {
              setListening(false);
              setInterim('');
              setError(code);
              voiceLog('speech-error', { code });
              if (callActiveRef.current) setVoiceState('listening');
            },
            onEnd: () => {
              setListening(false);
              // لا نُهدر النص: نُفرّغ أي جولة معلّقة عند نهاية الجلسة (نهاية الكلام).
              getGate().flush();
              setInterim('');
              webRecognizerRef.current = null;
              // متابعة تلقائية: نعيد الاستماع ما دامت المكالمة شغّالة.
              // B2a: لا نُعيد تشغيل الميكروفون أثناء النطق (TTS_SPEAKING)؛ يُعاد في finishSpeech.
              if (callActiveRef.current && !speakingRef.current) {
                setTimeout(() => { if (callActiveRef.current && !speakingRef.current && !listeningRef.current) startListeningRef.current(); }, 250);
              } else if (!speakingRef.current) {
                setVoiceState('idle');
              }
            },
          },
        );
        if (!recognizer) { releaseVoiceSession(VOICE_OWNER); return; }
        webRecognizerRef.current = recognizer;
        recognizer.start();
        return;
      }
      // الأصلي (Expo)
      const perm = await SpeechRecognitionModule?.requestPermissionsAsync?.();
      if (!perm?.granted) { voiceLog('mic-permission-denied'); setError('mic-permission'); return; }
      // قفل الجلسة: مسار واحد فقط يملك الميكروفون في أي لحظة.
      if (!claimVoiceSession(VOICE_OWNER)) { voiceLog('mic-session-busy', { platform: 'native' }); return; }
      getGate().reset();
      setInterim('');
      SpeechRecognitionModule?.start?.({ lang: speechLang(languageRef.current), interimResults: true, continuous: true });
    } catch (e: any) {
      voiceLog('mic-error', { message: e?.message });
      setListening(false);
      setError('mic-error');
    }
  }, [getGate]);

  const stopListening = useCallback(() => {
    if (noResultTimerRef.current) { clearTimeout(noResultTimerRef.current); noResultTimerRef.current = null; }
    gateRef.current?.dispose?.();
    try {
      if (Platform.OS === 'web') webRecognizerRef.current?.stop?.();
      else SpeechRecognitionModule?.stop?.();
    } catch {}
    releaseVoiceSession(VOICE_OWNER);
    setListening(false);
    setInterim('');
  }, []);

  // نربط المراجع بالدوال الفعلية لاستخدامها داخل الـ callbacks المستقرة.
  stopListeningRef.current = stopListening;
  startListeningRef.current = startListening;

  // --- زر الميكروفون (وضع فردي) ---
  const toggleMic = useCallback(async () => {
    if (listening) { stopListening(); setVoiceState('idle'); return; }
    await startListening();
  }, [listening, startListening, stopListening]);

  // --- بدء/إنهاء مكالمة صوتية مستمرة ---
  const startCall = useCallback(async () => {
    setCallActive(true);
    callActiveRef.current = true;
    setMuted(false);
    setError(null);
    await startListening();
  }, [startListening]);

  const endCall = useCallback(() => {
    setCallActive(false);
    callActiveRef.current = false;
    try { Speech.stop(); } catch {}
    setSpeakingId(null);
    stopListening();
    setVoiceState('idle');
  }, [stopListening]);

  const toggleMute = useCallback(() => {
    setMuted((prev) => {
      const next = !prev;
      if (next) { try { Speech.stop(); } catch {} setSpeakingId(null); }
      return next;
    });
  }, []);

  const toggleSpeaker = useCallback(() => setSpeakerOn((prev) => !prev), []);

  // عندما يصبح هذا المسار غير نشط (مخفي)، نوقف أي استماع ونحرّر قفل الجلسة فورًا
  // حتى لا يبقى مساران صوتيان يعملان في نفس الوقت (AssistantScreen + العائم).
  useEffect(() => {
    if (enabled) return;
    try { Speech.stop(); } catch {}
    setSpeakingId(null);
    stopListeningRef.current?.();
    setVoiceState('idle');
  }, [enabled]);

  // تسخين أصوات النطق الطبيعية مرة واحدة (أفضل صوت لكل لغة).
  useEffect(() => {
    void ensureTtsVoices();
  }, []);

  useEffect(() => () => {
    try {
      Speech.stop();
      gateRef.current?.dispose?.();
      webRecognizerRef.current?.abort?.();
      SpeechRecognitionModule?.abort?.();
      releaseVoiceSession(VOICE_OWNER);
    } catch {}
  }, []);

  return {
    messages,
    listening,
    interim,
    pending,
    speakingId,
    voiceState,
    callActive,
    muted,
    speakerOn,
    error,
    send,
    speak,
    toggleMic,
    startCall,
    endCall,
    toggleMute,
    toggleSpeaker,
    confirmPending,
    cancelPending,
    clearMessages: () => {
      // محادثة جديدة: نفرّغ الرسائل والسياق الطبي المتراكم معًا (فصل السياق القديم عن الجديد).
      painContextRef.current = null;
      gateRef.current?.newSession?.();
      setMessages([]);
      setPending([]);
    },
  };
}
