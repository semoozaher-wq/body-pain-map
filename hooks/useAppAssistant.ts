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

  // --- نطق الردود (يحترم الكتم) ---
  const speak = useCallback((text: string, id?: string) => {
    if (mutedRef.current || !speakerRef.current) return;
    try {
      Speech.stop();
      if (id) setSpeakingId(id);
      setVoiceState('speaking');
      Speech.speak(text, {
        language: ttsLang(languageRef.current),
        onDone: () => { setSpeakingId(null); setVoiceState(afterSpeechEnd(callActiveRef.current)); },
        onStopped: () => { setSpeakingId(null); setVoiceState(afterSpeechEnd(callActiveRef.current)); },
        onError: () => { setSpeakingId(null); setVoiceState(afterSpeechEnd(callActiveRef.current)); },
      });
    } catch {
      setSpeakingId(null);
      setVoiceState(afterSpeechEnd(callActiveRef.current));
    }
  }, []);

  // --- تنفيذ إجراءات جولة ---
  const runTurn = useCallback(
    (turn: AssistantTurn) => {
      for (const action of turn.actions) onAction(action);
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
      const turn = interpret(trimmed, state);
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
        const recognition = new Recognition();
        webRecognitionRef.current = recognition;
        recognition.lang = speechLang(languageRef.current);
        recognition.interimResults = true;
        // في وضع المكالمة نستخدم الاستماع المستمر للمتابعة التلقائية.
        recognition.continuous = callActiveRef.current;
        recognition.onstart = () => { setListening(true); setVoiceState('listening'); };
        recognition.onresult = (event: any) => {
          const result = event?.results?.[event.results.length - 1];
          const transcript = result?.[0]?.transcript ?? '';
          if (!transcript) return;
          if (voiceStateRef.current === 'speaking') {
            try { Speech.stop(); } catch {}
            setSpeakingId(null);
          }
          if (result.isFinal) { setInterim(''); send(transcript); }
          else setInterim(transcript);
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
            setTimeout(() => { if (callActiveRef.current && !listeningRef.current) startListening(); }, 250);
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
      SpeechRecognitionModule?.start?.({ lang: speechLang(languageRef.current), interimResults: true, continuous: callActiveRef.current });
    } catch {
      setListening(false);
      setError('mic-error');
    }
  }, [send]);

  const stopListening = useCallback(() => {
    try {
      if (Platform.OS === 'web') webRecognitionRef.current?.stop?.();
      else SpeechRecognitionModule?.stop?.();
    } catch {}
    setListening(false);
    setInterim('');
  }, []);

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
    clearMessages: () => setMessages([]),
  };
}
