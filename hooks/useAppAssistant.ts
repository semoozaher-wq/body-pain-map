// hooks/useAppAssistant.ts
// ============================================================================
// متحكّم المساعد المركزي (App-wide Assistant Controller)
// ----------------------------------------------------------------------------
// يدير جولة الحوار: يستقبل كلام المستخدم (كتابة/صوت)، يستدعي المحرّك، ينفّذ
// الإجراءات الآمنة عبر onAction، ويحتفظ بالإجراءات الحسّاسة للتأكيد.
// يحتوي آلة حالة صوتية حقيقية: استماع → تفكير → تحدّث → استماع (متابعة تلقائية)،
// مع مقاطعة (barge-in)، كتم، مكبّر صوت، إنهاء المكالمة، ومعالجة أخطاء الميكروفون/الشبكة.
// لا يعرف تفاصيل الشاشات — يتعامل فقط مع AppState + onAction (فصل تام).
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { SpeechRecognitionModule, useSpeechRecognitionEvents } from '../services/speechRecognition';
import { interpret } from '../services/appAssistant/engine';
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
const ttsLang = (language: string): string =>
  language === 'en' ? 'en-US' : language === 'fr' ? 'fr-FR' : 'ar-SA';

let msgSeq = 0;
const nextId = () => `am-${Date.now()}-${msgSeq++}`;

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
}

export function useAppAssistant({ getState, onAction, onTurn, language, autoSpeak = false }: UseAppAssistantOptions) {
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

  const webRecognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<any>(null);
  const turnBufferRef = useRef('');
  const startListeningRef = useRef<() => void>(() => {});
  const stopListeningRef = useRef<() => void>(() => {});
  const interimRef = useRef('');
  const lastResultIndexRef = useRef(0);
  const resultsLengthRef = useRef(0);
  // السياق الطبي المُجمَّع بين الرسائل (spec #4d): نمرّره للمحرّك في كل جولة حتى يبني
  // على ما قاله المستخدم سابقًا بدل أن يعيد السؤال.
  const painContextRef = useRef<any>(null);
  // مهلة الصمت التي نعتبرها نهاية جولة المستخدم (تمنحه وقتًا طبيعيًا للكلام قبل الرد).
  const TURN_SILENCE_MS = 1500;
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

  // --- نهاية النطق: نعود للاستماع داخل المكالمة، أو للخمول خارجها ---
  const finishSpeech = useCallback(() => {
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
      if (id) setSpeakingId(id);
      setVoiceState('speaking');
      Speech.speak(text, {
        language: ttsLang(languageRef.current),
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
      if (turn.mode === 'medical' && turn.medical?.painContext) painContextRef.current = turn.medical.painContext;
      if (turn.needsConfirmation) setPending(turn.pendingConfirmation);
      else setPending([]);
    },
    [onAction],
  );

  // --- إرسال رسالة نصية/صوتية (نفس المسار للكتابة والصوت ⇒ سياق متصل) ---
  const send = useCallback(
    (text: string): AssistantTurn | null => {
      const trimmed = text.trim();
      if (!trimmed) return null;
      setError(null);
      setVoiceState('thinking');
      const state = getState();
      const turn = interpret(trimmed, state, { previousContext: painContextRef.current ?? undefined });
      const userMsg: AssistantMessage = { id: nextId(), role: 'user', text: trimmed };
      const botMsg: AssistantMessage = { id: nextId(), role: 'assistant', text: turn.reply[state.language], turn };
      setMessages((prev) => [...prev, userMsg, botMsg]);
      runTurn(turn);
      onTurn?.(turn);
      if (autoSpeak || callActiveRef.current) speak(turn.reply[state.language], botMsg.id);
      else setVoiceState(afterSpeechEnd(callActiveRef.current));
      return turn;
    },
    [getState, runTurn, onTurn, autoSpeak, speak],
  );

  // --- نهاية جولة المستخدم: نُرسل النص المتراكم بعد صمت كافٍ (منع القطع المبكر) ---
  const commitTurn = useCallback(() => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    const text = `${turnBufferRef.current} ${interimRef.current}`.trim();
    turnBufferRef.current = '';
    interimRef.current = '';
    setInterim('');
    // نتجاهل أي نتائج نهائية متأخرة تخصّ الجولة المُرسلة.
    lastResultIndexRef.current = resultsLengthRef.current;
    if (text) {
      send(text);
      if (!callActiveRef.current) stopListeningRef.current?.();
    } else if (!callActiveRef.current) {
      stopListeningRef.current?.();
    }
  }, [send]);

  const scheduleTurnSend = useCallback(() => {
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    silenceTimerRef.current = setTimeout(commitTurn, TURN_SILENCE_MS);
  }, [commitTurn]);

  // --- تأكيد الإجراءات الحسّاسة المعلّقة ---
  const confirmPending = useCallback(() => {
    if (!pending.length) return;
    for (const action of pending) onAction({ ...action, requiresConfirmation: false });
    setPending([]);
    const botMsg: AssistantMessage = { id: nextId(), role: 'assistant', text: 'تم التنفيذ.' };
    setMessages((prev) => [...prev, botMsg]);
  }, [pending, onAction]);

  const cancelPending = useCallback(() => setPending([]), []);

  // --- أحداث التعرّف على الكلام (الأصلي) ---
  useSpeechRecognitionEvents('start', () => { setListening(true); setVoiceState('listening'); });
  useSpeechRecognitionEvents('end', () => {
    setListening(false);
    setInterim('');
    if (voiceStateRef.current === 'listening' && !callActiveRef.current) setVoiceState('idle');
  });
  useSpeechRecognitionEvents('error', (event: any) => {
    setListening(false);
    setInterim('');
    setError(event?.error ?? 'speech-error');
    setVoiceState(afterSpeechEnd(callActiveRef.current));
  });
  useSpeechRecognitionEvents('result', (event: any) => {
    const transcript: string = event?.results?.[0]?.transcript ?? '';
    if (!transcript) return;
    // مقاطعة: لو المساعد بيتكلم والمستخدم بدأ يتكلم، نوقف النطق فورًا.
    if (voiceStateRef.current === 'speaking') {
      try { Speech.stop(); } catch {}
      setSpeakingId(null);
    }
    if (event?.isFinal) {
      setInterim('');
      send(transcript);
    } else {
      setInterim(transcript);
    }
  });

  // --- تشغيل/إيقاف الاستماع ---
  const startListening = useCallback(async () => {
    setError(null);
    try {
      if (Platform.OS === 'web') {
        const browserWindow = globalThis as any;
        const Recognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
        if (!Recognition) { setError('no-speech-api'); return; }
        if (listeningRef.current) return;
        // جولة جديدة: نصفّر المخزن والمؤشرات.
        turnBufferRef.current = '';
        interimRef.current = '';
        lastResultIndexRef.current = 0;
        resultsLengthRef.current = 0;
        const recognition = new Recognition();
        webRecognitionRef.current = recognition;
        recognition.lang = speechLang(languageRef.current);
        recognition.interimResults = true;
        // نستمع باستمرار حتى لا نقطع المستخدم بعد كلمة أو جملة قصيرة.
        recognition.continuous = true;
        recognition.onstart = () => { setListening(true); setVoiceState('listening'); };
        recognition.onresult = (event: any) => {
          resultsLengthRef.current = event?.results?.length ?? 0;
          // مقاطعة: لو المساعد بيتكلم والمستخدم بدأ يتكلم، نوقف النطق فورًا.
          if (voiceStateRef.current === 'speaking') {
            try { Speech.stop(); } catch {}
            setSpeakingId(null);
          }
          let newFinal = '';
          let interimText = '';
          let lastFinalIdx = lastResultIndexRef.current - 1;
          for (let i = lastResultIndexRef.current; i < event.results.length; i++) {
            const r = event.results[i];
            if (r.isFinal) { newFinal += `${r[0].transcript} `; lastFinalIdx = i; }
            else interimText += r[0].transcript;
          }
          if (newFinal) {
            turnBufferRef.current = `${turnBufferRef.current} ${newFinal}`.trim();
            lastResultIndexRef.current = lastFinalIdx + 1;
          }
          interimRef.current = interimText;
          setInterim(interimText);
          // لا نرسل فورًا: ننتظر صمتًا كافيًا حتى يكمل المستخدم كلامه.
          scheduleTurnSend();
        };
        recognition.onerror = (event: any) => {
          setListening(false);
          setInterim('');
          setError(event?.error ?? 'speech-error');
          if (callActiveRef.current) setVoiceState('listening');
        };
        recognition.onend = () => {
          setListening(false);
          setInterim('');
          webRecognitionRef.current = null;
          // متابعة تلقائية: نعيد الاستماع ما دامت المكالمة شغّالة.
          if (callActiveRef.current) {
            setTimeout(() => { if (callActiveRef.current && !listeningRef.current) startListeningRef.current(); }, 250);
          } else {
            setVoiceState('idle');
          }
        };
        recognition.start();
        return;
      }
      // الأصلي (Expo)
      const perm = await SpeechRecognitionModule?.requestPermissionsAsync?.();
      if (!perm?.granted) { setError('mic-permission'); return; }
      setInterim('');
      SpeechRecognitionModule?.start?.({ lang: speechLang(languageRef.current), interimResults: true, continuous: true });
    } catch {
      setListening(false);
      setError('mic-error');
    }
  }, [scheduleTurnSend]);

  const stopListening = useCallback(() => {
    if (silenceTimerRef.current) { clearTimeout(silenceTimerRef.current); silenceTimerRef.current = null; }
    try {
      if (Platform.OS === 'web') webRecognitionRef.current?.stop?.();
      else SpeechRecognitionModule?.stop?.();
    } catch {}
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

  useEffect(() => () => {
    try {
      Speech.stop();
      webRecognitionRef.current?.abort?.();
      SpeechRecognitionModule?.abort?.();
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
      setMessages([]);
      setPending([]);
    },
  };
}
