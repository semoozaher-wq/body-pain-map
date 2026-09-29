// hooks/useAppAssistant.ts
// ============================================================================
// متحكّم المساعد المركزي (App-wide Assistant Controller)
// ----------------------------------------------------------------------------
// يدير جولة الحوار: يستقبل كلام المستخدم (كتابة/صوت)، يستدعي المحرّك، ينفّذ
// الإجراءات الآمنة عبر onAction، ويحتفظ بالإجراءات الحسّاسة للتأكيد.
// لا يعرف تفاصيل الشاشات — يتعامل فقط مع AppState + onAction (فصل تام).
// ============================================================================

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { SpeechRecognitionModule, useSpeechRecognitionEvents } from '../services/speechRecognition';
import { interpret } from '../services/appAssistant/engine';
import type { AppState, AssistantAction, AssistantTurn, Lang } from '../services/appAssistant/types';

export interface AssistantMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  turn?: AssistantTurn;
}

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
  language: Lang;
  /** نطق الردود تلقائيًا. */
  autoSpeak?: boolean;
}

export function useAppAssistant({ getState, onAction, language, autoSpeak = false }: UseAppAssistantOptions) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [pending, setPending] = useState<AssistantAction[]>([]);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const webRecognitionRef = useRef<any>(null);
  const languageRef = useRef(language);
  languageRef.current = language;

  // --- نطق الردود ---
  const speak = useCallback((text: string, id?: string) => {
    try {
      Speech.stop();
      if (id) setSpeakingId(id);
      Speech.speak(text, {
        language: ttsLang(languageRef.current),
        onDone: () => setSpeakingId(null),
        onStopped: () => setSpeakingId(null),
        onError: () => setSpeakingId(null),
      });
    } catch {
      setSpeakingId(null);
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

  // --- إرسال رسالة نصية/صوتية ---
  const send = useCallback(
    (text: string): AssistantTurn | null => {
      const trimmed = text.trim();
      if (!trimmed) return null;
      const state = getState();
      const turn = interpret(trimmed, state);
      const userMsg: AssistantMessage = { id: nextId(), role: 'user', text: trimmed };
      const botMsg: AssistantMessage = { id: nextId(), role: 'assistant', text: turn.reply[state.language], turn };
      setMessages((prev) => [...prev, userMsg, botMsg]);
      runTurn(turn);
      if (autoSpeak) speak(turn.reply[state.language], botMsg.id);
      return turn;
    },
    [getState, runTurn, autoSpeak, speak],
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

  // --- التعرف على الكلام ---
  useSpeechRecognitionEvents('start', () => setListening(true));
  useSpeechRecognitionEvents('end', () => { setListening(false); setInterim(''); });
  useSpeechRecognitionEvents('error', () => { setListening(false); setInterim(''); });
  useSpeechRecognitionEvents('result', (event: any) => {
    const transcript: string = event?.results?.[0]?.transcript ?? '';
    if (!transcript) return;
    if (event?.isFinal) {
      setInterim('');
      send(transcript);
    } else {
      setInterim(transcript);
    }
  });

  const toggleMic = useCallback(async () => {
    try {
      if (Platform.OS === 'web') {
        const browserWindow = globalThis as any;
        const Recognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;
        if (!Recognition) return;
        if (listening) { webRecognitionRef.current?.stop?.(); return; }
        const recognition = new Recognition();
        webRecognitionRef.current = recognition;
        recognition.lang = speechLang(languageRef.current);
        recognition.interimResults = true;
        recognition.continuous = false;
        recognition.onstart = () => setListening(true);
        recognition.onresult = (event: any) => {
          const result = event?.results?.[event.results.length - 1];
          const transcript = result?.[0]?.transcript ?? '';
          if (!transcript) return;
          if (result.isFinal) { setInterim(''); send(transcript); }
          else setInterim(transcript);
        };
        recognition.onerror = () => { setListening(false); setInterim(''); };
        recognition.onend = () => { setListening(false); setInterim(''); webRecognitionRef.current = null; };
        recognition.start();
        return;
      }
      if (listening) { SpeechRecognitionModule?.stop?.(); return; }
      const perm = await SpeechRecognitionModule?.requestPermissionsAsync?.();
      if (!perm?.granted) return;
      setInterim('');
      SpeechRecognitionModule?.start?.({ lang: speechLang(languageRef.current), interimResults: true, continuous: false });
    } catch {
      setListening(false);
    }
  }, [listening, send]);

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
    send,
    speak,
    toggleMic,
    confirmPending,
    cancelPending,
    clearMessages: () => setMessages([]),
  };
}
