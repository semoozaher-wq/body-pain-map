// screens/AssistantScreen.tsx
// ============================================================================
// شاشة المساعد الذكي — دردشة تفهم كلام المستخدم وتردّ بإرشاد تعليمي.
// تدعم: الكتابة، الإدخال الصوتي (🎤)، نطق الردود (🔊)، وإرفاق صورة (📷).
// المحرّك النصّي يعمل بالكامل دون إنترنت (محلّي) — لا يُرسل أي بيانات لخادم.
// ----------------------------------------------------------------------------
// v2: إزالة أكواد ICD من العرض + تبسيط الأسماء الطبية + أيقونات
// ============================================================================

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Speech from 'expo-speech';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SpeechRecognitionModule, useSpeechRecognitionEvents } from '../services/speechRecognition';
import { createWebRecognizer, webSpeechSupported, isLikelyInAppBrowser, type SpeechSnapshot, type WebRecognizer } from '../services/speech/webSpeech';
import { voiceLog } from '../services/speech/voiceLog';
import { normalizeSpeechText } from '../services/speech/arabicSpeech';
import { createTurnGate, type TurnGate } from '../services/speech/turnGate';
import { collapseWhitespace, mergeSpeechTranscript, normalizeTranscript, TRANSCRIPT_MERGE_DEBOUNCE_MS } from '../services/speech/transcript';
import { speakNatural, ensureTtsVoices } from '../services/speech/tts';
import { claimVoiceSession, releaseVoiceSession, isVoiceSessionOwner } from '../services/speech/voiceSession';
import { Colors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import { Palette, Gradients, Radii, Elevation, Type } from '../constants/design';
import { Gradient } from '../components/Gradient';
import { GlowOrb } from '../components/GlowOrb';
import { useTheme } from '../hooks/useTheme';
import { translate } from '../services/i18n';
import {
  QUICK_PROMPTS,
  SYMPTOM_QUICK_CHIPS,
  type AssistantReply,
  type Lang,
  type TriageLevel,
} from '../services/aiAssistant';
import { interpretAsync } from '../services/appAssistant/engine';
import type { AppState, AssistantAction } from '../services/appAssistant/types';

type ChatMessage =
  | { id: string; role: 'user'; text: string; imageUri?: string }
  | { id: string; role: 'assistant'; kind: 'rich'; reply: AssistantReply }
  | { id: string; role: 'assistant'; kind: 'text'; text: string };

// Keep the conversation alive across screen unmounts (e.g. when a pain message
// navigates to the map). This mirrors GlobalAssistant, which stays mounted while
// the underlying screen changes, so multi-turn location refinement keeps working.
let persistedMessages: ChatMessage[] = [];
let persistedAskCount = 0;

interface AssistantScreenProps {
  language: Parameters<typeof translate>[0];
  direction: 'rtl' | 'ltr';
  onOpenRegion: (regionId: string) => void;
  onOpenOrgan: (organId: string) => void;
  initialContext?: string;
  /** حالة التطبيق الحالية (نفس مصدر GlobalAssistant) — لتوحيد المحرّك. */
  appState?: AppState;
  /** ينفّذ أوامر التحكّم في التطبيق (تنقّل/إبراز/علامة ألم) من داخل الشاشة. */
  onAction?: (action: AssistantAction) => void;
}

const TRIAGE_COLORS: Record<TriageLevel, { bg: string; fg: string; accent: string }> = {
  self_care: { bg: '#ECFDF5', fg: '#047857', accent: Palette.mint },
  routine: { bg: '#E6F7F5', fg: '#0E6972', accent: Palette.teal400 },
  soon: { bg: '#FFFBEB', fg: '#B45309', accent: Palette.amber },
  urgent: { bg: '#FFF1F2', fg: '#BE123C', accent: Palette.coral },
  emergency: { bg: '#FEF2F2', fg: '#B91C1C', accent: Palette.rose },
};

// ============================================================================
// خريطة تبسيط الأسماء الطبية — بتحوّل الأسماء المعقّدة لعبارات يفهمها المريض
// ============================================================================
const SIMPLE_NAMES: Record<string, string> = {
  // أمراض العظام والعضلات
  'M54.5': 'وجع في أسفل الظهر',
  'M54.2': 'وجع في الرقبة',
  'M75.1': 'إصابة الكتف',
  'M17': 'خشونة الركبة',
  'M79.67': 'وجع في العضلات المنتشر',
  'G43': 'صداع نصفي',
  'G44.2': 'صداع من التوتر',
  'M79.1': 'وجع في العضلات',
  'S93.4': 'لوي الكاحل',
  'M72.2': 'وجع الكعب',
  'M79.64': 'وجع في اليد',
  'M62.838': 'شد عضلي',
  'M79.7': 'التهاب في الوتر',
  'M19.9': 'خشونة المفاصل',
  'M05': 'روماتويد',
  'G56.0': 'تنميل اليد (نفق رسغي)',
  'M50.1': 'ديسك الرقبة',
  'M51.16': 'ديسك أسفل الظهر (عرق النسا)',
  'G62.9': 'تنميل الأطراف',
  'I10': 'ضغط الدم',
  'K21.9': 'حموضة المعدة',
  'M79.1-doms': 'وجع بعد التمرين',
  'M25.50': 'وجع في المفاصل',
  // أمراض الأعضاء الداخلية
  'K35': 'التهاب الزائدة',
  'K29': 'التهاب المعدة',
  'K27': 'قرحة المعدة',
  'K58': 'القولون العصبي',
  'K57': 'التهاب القولون',
  'A09': 'نزلة معوية',
  'K80': 'حصى المرارة',
  'K75.9': 'التهاب الكبد',
  'K85': 'التهاب البنكرياس',
  'N39.0': 'التهاب المسالك',
  'N20.0': 'حصى الكلى',
  'N83.2': 'كيس على المبيض',
  'N80': 'بطانة الرحم',
  'I20.9': 'ذبحة صدرية',
};

// ============================================================================
// خريطة الأيقونات حسب كود ICD
// ============================================================================
const CONDITION_ICONS: Record<string, string> = {
  // عظام ومفاصل
  'M54.5': '🦴', 'M54.2': '🦴', 'M75.1': '💪', 'M17': '🦴',
  'M79.67': '💪', 'M19.9': '🦴', 'M05': '🦴', 'M62.838': '💪',
  'M79.7': '💪', 'M50.1': '🦴', 'M51.16': '🦴', 'M25.50': '🦴',
  'M79.1': '💪', 'M79.1-doms': '💪',
  // أعصاب وصداع
  'G43': '🤕', 'G44.2': '🤕', 'G56.0': '🖐️', 'G62.9': '🧠',
  // أطراف
  'S93.4': '🦶', 'M72.2': '🦶', 'M79.64': '🖐️',
  // أعضاء داخلية
  'K35': '🫀', 'K29': '💧', 'K27': '💧', 'K58': '🫀', 'K57': '🫀',
  'A09': '🫀', 'K80': '🫀', 'K75.9': '🫀', 'K85': '🫀',
  'N39.0': '💧', 'N20.0': '💧', 'N83.2': '🫀', 'N80': '🫀',
  'K21.9': '💧',
  // قلب وضغط
  'I20.9': '❤️', 'I10': '❤️',
};

/** الحصول على اسم بسيط + أيقونة حسب كود ICD. */
function getSimpleCondition(icd10: string, fallbackName: string): { icon: string; name: string } {
  const simpleName = SIMPLE_NAMES[icd10];
  const icon = CONDITION_ICONS[icd10] ?? '🩺';
  // لو مفيش اسم بسيط، نستخدم الاسم الأصلي بعد تنظيفه
  const name = simpleName ?? cleanMedicalName(fallbackName);
  return { icon, name };
}

/** تنظيف الاسم الطبي: إزالة "القطني"، "العنقي"، الأقواس الزائدة. */
function cleanMedicalName(name: string): string {
  return name
    .replace(/\(القطني\)/g, '')
    .replace(/\(العنقي\)/g, '')
    .replace(/القطني/g, 'أسفل الظهر')
    .replace(/العنقي/g, 'الرقبة')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * دمج نص التعرّف الأصلي (native) في النص التراكمي للجلسة.
 *
 * أندرويد يعيد "تثبيت" نفس الجملة، وأحيانًا يعيد إرسال النص التراكمي كاملًا،
 * لذا فإن اللصق الأعمى (`prev + next`) يضاعف الكلام. هنا نجعل الدمج آمنًا
 * ضدّ التكرار: المقطع الجديد يُلحق، والنص التراكمي المعاد يُستبدل، والتكرار
 * الحرفي يُرجع null حتى يتخطّاه المستدعي.
 */
// هوية هذا المسار الصوتي في قفل الجلسة المفردة (services/speech/voiceSession).
const VOICE_OWNER = 'assistant';

function mergeNativeTranscript(prev: string, next: string): string | null {
  const p = collapseWhitespace(prev);
  const n = collapseWhitespace(next);
  if (!n) return p || null; // لا يوجد نص جديد
  const merged = mergeSpeechTranscript(p, n);
  return merged === p ? null : merged; // تكرار/إعادة إرسال مطابقة → تجاهل بلا إرسال
}

let msgCounter = 0;
const nextId = () => `m${Date.now()}-${msgCounter++}`;

/**
 * Loop breaker: how many clarifying questions the assistant may ask in a row
 * before it must answer with whatever the user already gave.
 * Kept in sync with the engine's `askCount >= 2` rule.
 */
const MAX_CLARIFY_ASKS = 2;

/** لغة التعرّف على الكلام حسب لغة الواجهة. */
const speechLang = (language: string): string =>
  language === 'en' ? 'en-US' : language === 'fr' ? 'fr-FR' : 'ar-EG';

/** يبني نصًّا مختصرًا قابلًا للنطق من رد المساعد. */
function replyToSpeech(reply: AssistantReply): string {
  const L = reply.__lang ?? 'ar';
  const parts: string[] = [reply.intro[L]];
  if (reply.clarifyingQuestion) parts.push(reply.clarifyingQuestion[L]);
  if (reply.clarificationOnly) return parts.filter(Boolean).join('. ');
  parts.push(reply.triage.title[L], reply.triage.advice[L]);
  reply.redFlags.forEach((f) => parts.push(f.label[L]));
  reply.selfCare.slice(0, 4).forEach((s) => parts.push(s));
  parts.push(reply.whenToSeeDoctor[L]);
  return parts.filter(Boolean).join('. ');
}

/** حالة تطبيق احتياطية إن لم تُمرَّر من المضيف (نادر). */
function fallbackState(language: Lang): AppState {
  return {
    currentScreen: 'assistant',
    currentTab: 'muscles',
    currentBodyView: 'front',
    currentSex: 'male',
    selectedBodyRegion: null,
    selectedAnatomyStructure: null,
    selectedPoint: null,
    selectedPainLocation: null,
    painSeverity: null,
    symptoms: [],
    lastAssistantAction: null,
    lastUserReference: null,
    conversationState: 'idle',
    zoomLevel: 1,
    visibleStructures: [],
    conversationContext: {
      lastReferencedId: null,
      lastReferencedKind: null,
      lastReferencedLabel: null,
      lastReferencedCoords: null,
      previousReferencedId: null,
      previousReferencedCoords: null,
    },
    language,
    conversationMode: 'idle',
  };
}

/**
 * يحوّل صورة المستخدم (URI) إلى data URL حتى تُمرَّر إلى طبقة الذكاء الاصطناعي
 * (Gemini) كمدخل متعدّد الوسائط. على الويب نقرأ الـ blob عبر FileReader، وعلى
 * الأنظمة الأصلية نقرأ base64 عبر expo-file-system. عند أي فشل نُعيد null فيكمل
 * المسار بلا صورة (لا نُعطّل الجولة).
 */
async function toImageDataUrl(uri: string): Promise<string | null> {
  try {
    if (uri.startsWith('data:')) return uri;
    if (Platform.OS === 'web') {
      const res = await fetch(uri);
      const blob = await res.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result ?? ''));
        reader.onerror = () => reject(new Error('image-read-error'));
        reader.readAsDataURL(blob);
      });
    }
    const legacyFs: any = await import('expo-file-system/legacy');
    const base64: string = await legacyFs.readAsStringAsync(uri, { encoding: legacyFs.EncodingType.Base64 });
    const ext = (uri.split('.').pop() ?? 'jpg').toLowerCase();
    const mime = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
    return `data:${mime};base64,${base64}`;
  } catch {
    return null;
  }
}

export const AssistantScreen: React.FC<AssistantScreenProps> = ({ language, direction, onOpenRegion, onOpenOrgan, initialContext, appState, onAction }) => {
  const { colors } = useTheme();
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const rtl = direction === 'rtl';
  const align = rtl ? 'right' : 'left';
  const row = rtl ? 'row-reverse' : 'row';

  const [messages, setMessages] = useState<ChatMessage[]>(persistedMessages);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [returningReminder, setReturningReminder] = useState(false);
  /** How many clarifying questions were asked in a row (shown in the status line). */
  const [askCount, setAskCount] = useState(persistedAskCount);
  const scrollRef = useRef<ScrollView>(null);
  const webRecognizerRef = useRef<WebRecognizer | null>(null);
  // Mirror of `askCount` so two sends in the same tick can never both read a
  // stale counter (this is what previously made the question repeat forever).
  const askCountRef = useRef(persistedAskCount);
  // يحمل الصورة السريرية المتراكمة (PainContext) بين الأدوار حتى يبني السياق تدريجيًا.
  const painContextRef = useRef<any>(null);
  const initialContextSentRef = useRef(false);
  const mountedRef = useRef(true);
  const replyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ------------------------------------------------------------------
  // المحرّك الموحّد + أوامر التحكّم (نفس مصدر GlobalAssistant)
  // ------------------------------------------------------------------
  const appStateRef = useRef<AppState | undefined>(appState);
  appStateRef.current = appState;
  const onActionRef = useRef<((action: AssistantAction) => void) | undefined>(onAction);
  onActionRef.current = onAction;

  // ------------------------------------------------------------------
  // تبادل الأدوار الصوتي (نفس سلوك GlobalAssistant): استماع مستمر + مهلة صمت
  // ------------------------------------------------------------------
  const noResultTimerRef = useRef<any>(null);
  // TurnGate: single source of truth for voice-transcript bookkeeping
  // (live/committed/pending + silence debounce). It replaces the previous
  // hand-rolled per-ref bookkeeping so one utterance produces
  // exactly one turn — no interim -> final -> onend -> silence double-send, and
  // it is immune to Android re-finalising / replacing `event.results`.
  const gateRef = useRef<TurnGate | null>(null);
  // Cumulative transcript for the native (expo-speech-recognition) path, whose
  // final results arrive as segments; we accumulate them so the TurnGate sees a
  // cumulative live string exactly like the web path does.
  const nativeLiveRef = useRef('');
  // آخر جملة نهائية مُرّرت للـTurnGate. تبقى عبر دورة end→restart→reset حتى لا
  // تُحتسب إعادة إرسالها من المتعرّف بعد إعادة التشغيل كجولة ثانية.
  const nativeLastFinalRef = useRef<{ text: string; at: number }>({ text: '', at: 0 });
  const gotResultRef = useRef(false);
  const startListeningRef = useRef<() => void>(() => {});
  const stopListeningRef = useRef<() => void>(() => {});
  const sendRef = useRef<(text: string, imageUri?: string | null) => void>(() => {});
  const listeningRef = useRef(false);
  listeningRef.current = listening;
  const voiceSessionRef = useRef(false);
  const speakingRef = useRef(false);
  const languageRef = useRef(language);
  languageRef.current = language;
  const TURN_SILENCE_MS = 1500;
  const NO_RESULT_WATCHDOG_MS = 7000;
  // B2b: نافذة إزالة تكرار التثبيت النهائي، بحدّ أدنى TRANSCRIPT_MERGE_DEBOUNCE_MS
  // (300ms) حتى لا يقلّ إخماد التكرار السريع عن المهلة المطلوبة في التقرير.
  const NATIVE_DEDUP_WINDOW_MS = Math.max(2500, TRANSCRIPT_MERGE_DEBOUNCE_MS);

  // --- TurnGate: one utterance => one turn (shared, tested implementation) ---
  // Both the web and native recognition paths funnel through this single gate so
  // the "live/committed/pending + silence debounce" logic lives in exactly one
  // place (services/speech/turnGate.ts) instead of being duplicated per screen.
  const getGate = useCallback((): TurnGate => {
    if (!gateRef.current) {
      gateRef.current = createTurnGate({
        silenceMs: TURN_SILENCE_MS,
        onInterim: (text) => setInterim(text),
        onTurn: (text) => {
          sendRef.current(text);
          if (!voiceSessionRef.current) stopListeningRef.current?.();
        },
        onEmpty: () => {
          if (!voiceSessionRef.current) stopListeningRef.current?.();
        },
        onLog: (stage, data) => voiceLog(stage, data),
      });
    }
    return gateRef.current;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    AsyncStorage.getItem('bodymap.lastAssistantVisit').then((value) => {
      if (value && Date.now() - Number(value) > 24 * 60 * 60 * 1000 && mountedRef.current) setReturningReminder(true);
    }).catch(() => {});
    return () => {
      mountedRef.current = false;
      if (replyTimerRef.current) {
        clearTimeout(replyTimerRef.current);
        replyTimerRef.current = null;
      }
    };
  }, []);

  // \u0646\u062d\u0641\u0637 \u0627\u0644\u0645\u062d\u0627\u062f\u062b\u0629 \u062e\u0627\u0631\u062c \u0627\u0644\u0645\u0643\u0648\u0651\u0646 \u0644\u062a\u0628\u0642\u0649 \u0628\u0639\u062f \u0627\u0644\u062a\u0646\u0642\u0651\u0644 (\u0645\u062b\u0644 GlobalAssistant \u0627\u0644\u0630\u064a \u064a\u0628\u0642\u0649 \u0645\u0648\u062c\u0648\u062f\u064b\u0627).
  useEffect(() => { persistedMessages = messages; }, [messages]);
  useEffect(() => { persistedAskCount = askCount; }, [askCount]);

  // ------------------------------------------------------------------
  // التعرّف على الكلام (الإدخال الصوتي) — تبادل أدوار طبيعي
  // ------------------------------------------------------------------
  useSpeechRecognitionEvents('start', () => {
    if (!isVoiceSessionOwner(VOICE_OWNER)) return;
    voiceLog('mic-start', { platform: 'native' });
    setListening(true);
  });
  useSpeechRecognitionEvents('end', () => {
    if (!isVoiceSessionOwner(VOICE_OWNER)) return;
    voiceLog('mic-end', { platform: 'native' });
    setListening(false);
    // لا نُهدر النص: نُفرّغ أي جولة معلّقة عند نهاية الجلسة (نهاية الكلام).
    getGate().flush();
    setInterim('');
    // متابعة تلقائية على الأندرويد: بعض محرّكات الكلام تُنهي الجلسة بعد صمت،
    // فنعيد الاستماع ما دامت الجلسة الصوتية شغّالة (نفس سلوك مسار الويب).
    // B2a: لا نُعيد تشغيل الميكروفون أثناء النطق (TTS_SPEAKING)؛ يُعاد في finishSpeech.
    if (voiceSessionRef.current && !speakingRef.current) {
      setTimeout(() => { if (voiceSessionRef.current && !speakingRef.current && !listeningRef.current) startListeningRef.current(); }, 250);
    }
  });
  useSpeechRecognitionEvents('error', (event: any) => {
    if (!isVoiceSessionOwner(VOICE_OWNER)) return;
    voiceLog('speech-error', { platform: 'native', code: event?.error });
    setListening(false);
  });
  useSpeechRecognitionEvents('result', (event: any) => {
    if (!isVoiceSessionOwner(VOICE_OWNER)) return;
    const transcript: string = event?.results?.[0]?.transcript ?? '';
    if (!transcript) return;
    const speechText = normalizeSpeechText(transcript);
    if (!speechText) return;
    voiceLog('speech-result', { platform: 'native', transcript, normalized: speechText, isFinal: !!event?.isFinal });
    // مقاطعة: لو المساعد بيتكلم والمستخدم بدأ يتكلم، نوقف النطق فورًا.
    if (speakingRef.current) { try { Speech.stop(); } catch {} setSpeakingId(null); speakingRef.current = false; }

    // دمج آمن ضدّ التكرار: أندرويد يعيد تثبيت الجملة أو يعيد النص التراكمي كاملًا،
    // فكان اللصق الأعمى (`prev + transcript`) يضاعف الكلام. mergeNativeTranscript
    // يُرجع null عند التكرار الحرفي حتى نتخطّاه بلا إرسال.
    const merged = mergeNativeTranscript(nativeLiveRef.current, speechText);
    if (merged === null) {
      voiceLog('speech-result-dedup', { platform: 'native', transcript });
      return;
    }
    nativeLiveRef.current = merged;

    if (event?.isFinal) {
      // حارس عبر إعادة التشغيل: نفس الجملة النهائية لا تُحتسب مرّتين بعد end→restart→reset.
      const norm = normalizeTranscript(merged);
      const last = nativeLastFinalRef.current;
      if (norm && norm === last.text && Date.now() - last.at < NATIVE_DEDUP_WINDOW_MS) {
        voiceLog('speech-result-dedup', { platform: 'native', transcript });
        return;
      }
      nativeLastFinalRef.current = { text: norm, at: Date.now() };
      // جولة واحدة لكل جملة؛ لا إرسال فوري — البوّابة تنتظر صمتًا كافيًا.
      getGate().onFinal(merged);
    } else {
      // الجزئية = معاينة حيّة فقط (لا تُرسل).
      getGate().onSnapshot({ liveText: merged, hasFinal: false });
    }
  });

  // نهاية جولة المستخدم + معالجة نتيجة التعرّف (ويب) انتقلت إلى services/speech/turnGate.ts:
  // البوّابة تجمع النص (live/committed/pending)، تمنع الإرسال المزدوج، وتُطلق جولة واحدة
  // بعد صمت كافٍ. مسار الويب يغذّيها عبر getGate().onSnapshot(snap) داخل startListening.

  const stopListening = useCallback(() => {
    gateRef.current?.dispose?.();
    if (noResultTimerRef.current) { clearTimeout(noResultTimerRef.current); noResultTimerRef.current = null; }
    try {
      if (Platform.OS === 'web') webRecognizerRef.current?.stop?.();
      else SpeechRecognitionModule?.stop?.();
    } catch {}
    releaseVoiceSession(VOICE_OWNER);
    setListening(false);
    setInterim('');
  }, []);

  const startListening = useCallback(async () => {
    setVoiceError(null);
    try {
      // expo-speech-recognition is native-first and does not reliably expose
      // a permission flow on Expo Web/Vercel. Use the browser Web Speech API
      // there, which triggers the browser's own microphone permission prompt.
      if (Platform.OS === 'web') {
        if (listeningRef.current) return;
        if (!webSpeechSupported()) {
          voiceLog('mic-start', { supported: false, inApp: isLikelyInAppBrowser() });
          setVoiceError(isLikelyInAppBrowser() ? 'voiceInApp' : 'voiceUnsupported');
          return;
        }
        // قفل الجلسة: مسار واحد فقط يملك الميكروفون في أي لحظة.
        if (!claimVoiceSession(VOICE_OWNER)) { voiceLog('mic-session-busy', { platform: 'web' }); return; }
        // جولة جديدة: نُصفّر البوّابة والمؤشرات.
        getGate().reset();
        gotResultRef.current = false;
        const recognizer = createWebRecognizer(
          { lang: speechLang(languageRef.current), continuous: voiceSessionRef.current, interimResults: true, maxAlternatives: 3 },
          {
            log: (stage, data) => voiceLog(stage, data),
            onStart: () => {
              setListening(true);
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
              if (speakingRef.current) { try { Speech.stop(); } catch {} setSpeakingId(null); speakingRef.current = false; }
              // البوّابة تتعامل مع نموذجي الإلحاق/الاستبدال وتُطلق جولة واحدة لكل جملة.
              getGate().onSnapshot(snap);
            },
            onError: (code) => {
              setListening(false);
              setInterim('');
              voiceLog('speech-error', { code });
              if (code === 'not-allowed' || code === 'service-not-allowed') setVoiceError('voiceUnsupported');
            },
            onEnd: () => {
              setListening(false);
              // لا نُهدر النص: نُفرّغ أي جولة معلّقة عند نهاية الجلسة (نهاية الكلام).
              getGate().flush();
              setInterim('');
              webRecognizerRef.current = null;
              // متابعة تلقائية: نعيد الاستماع ما دامت الجلسة الصوتية شغّالة.
              // B2a: لا نُعيد تشغيل الميكروفون أثناء النطق (TTS_SPEAKING)؛ يُعاد في finishSpeech.
              if (voiceSessionRef.current && !speakingRef.current) {
                setTimeout(() => { if (voiceSessionRef.current && !speakingRef.current && !listeningRef.current) startListeningRef.current(); }, 250);
              }
            },
          },
        );
        if (!recognizer) { releaseVoiceSession(VOICE_OWNER); return; }
        webRecognizerRef.current = recognizer;
        recognizer.start();
        return;
      }
      const perm = await SpeechRecognitionModule?.requestPermissionsAsync?.();
      if (!perm?.granted) { voiceLog('mic-permission-denied'); return; }
      // قفل الجلسة: مسار واحد فقط يملك الميكروفون في أي لحظة.
      if (!claimVoiceSession(VOICE_OWNER)) { voiceLog('mic-session-busy', { platform: 'native' }); return; }
      getGate().reset();
      nativeLiveRef.current = '';
      setInterim('');
      SpeechRecognitionModule?.start?.({
        lang: speechLang(languageRef.current),
        interimResults: true,
        continuous: true,
      });
    } catch (e: any) {
      voiceLog('mic-error', { message: e?.message });
      setListening(false);
    }
  }, [getGate]);

  // نربط المراجع بالدوال الفعلية لاستخدامها داخل الـ callbacks المستقرة.
  stopListeningRef.current = stopListening;
  startListeningRef.current = startListening;

  const toggleMic = useCallback(async () => {
    // جلسة صوتية مستمرة: نقرة للبدء، ونقرة أخرى للإنهاء.
    if (voiceSessionRef.current) {
      voiceSessionRef.current = false;
      stopListening();
      return;
    }
    voiceSessionRef.current = true;
    // جلسة جديدة: نصفّر ذاكرة إزالة تكرار الجملة الأخيرة (تبقى فقط عبر إعادة التشغيل).
    nativeLastFinalRef.current = { text: '', at: 0 };
    await startListening();
  }, [startListening, stopListening]);

  // ------------------------------------------------------------------
  // محادثة جديدة (spec #4b): نفرّغ الرسائل والسياق الطبي معًا، ونوقف أي
  // استماع/نطق جارٍ، حتى لا يتسرّب سياق المحادثة القديمة إلى الجديدة.
  // ------------------------------------------------------------------
  const newConversation = useCallback(() => {
    voiceSessionRef.current = false;
    stopListening();
    try { Speech.stop(); } catch {}
    speakingRef.current = false;
    setSpeakingId(null);
    painContextRef.current = null;
    askCountRef.current = 0;
    setAskCount(0);
    persistedMessages = [];
    persistedAskCount = 0;
    gateRef.current?.newSession?.();
    nativeLiveRef.current = '';
    nativeLastFinalRef.current = { text: '', at: 0 };
    gotResultRef.current = false;
    setInterim('');
    setVoiceError(null);
    setInput('');
    setMessages([]);
  }, [stopListening]);

  // ------------------------------------------------------------------
  // نطق الردود (إخراج صوتي)
  // ------------------------------------------------------------------
  const finishSpeech = useCallback(() => {
    setSpeakingId(null);
    speakingRef.current = false;
    // متابعة تلقائية: بعد الرد نرجع للاستماع إن كانت الجلسة الصوتية شغّالة.
    if (voiceSessionRef.current) {
      setTimeout(() => { if (voiceSessionRef.current && !listeningRef.current) startListeningRef.current(); }, 200);
    }
  }, []);

  const speak = useCallback(
    (text: string, id?: string) => {
      try {
        Speech.stop();
        // B2a (report fix): أوقف الاستماع (STT) فورًا عند بدء النطق (TTS_SPEAKING)
        // لمنع تراكب الميكروفون مع صوت المساعد (صدى/تغذية راجعة). نُبقي جلسة الصوت
        // مفتوحة ويُعاد الاستماع تلقائيًا في finishSpeech بعد انتهاء النطق.
        speakingRef.current = true;
        try {
          if (Platform.OS === 'web') webRecognizerRef.current?.stop?.();
          else SpeechRecognitionModule?.stop?.();
        } catch {}
        setListening(false);
        if (id) setSpeakingId(id);
        // نطق طبيعي: أفضل صوت متاح للغة + نبرة/سرعة طبيعية (بدل الصوت الآلي الافتراضي).
        speakNatural(text, language, {
          onDone: finishSpeech,
          onStopped: finishSpeech,
          onError: finishSpeech,
        });
      } catch {
        finishSpeech();
      }
    },
    [language, finishSpeech],
  );

  // تسخين أصوات النطق الطبيعية مرة واحدة عند فتح الشاشة (أفضل صوت لكل لغة).
  useEffect(() => {
    void ensureTtsVoices();
  }, []);

  useEffect(() => () => {
    try {
      voiceSessionRef.current = false;
      gateRef.current?.dispose?.();
      if (noResultTimerRef.current) clearTimeout(noResultTimerRef.current);
      Speech.stop();
      webRecognizerRef.current?.abort?.();
      SpeechRecognitionModule?.abort?.();
      releaseVoiceSession(VOICE_OWNER);
    } catch {}
  }, []);

  // ------------------------------------------------------------------
  // إرفاق صورة
  // ------------------------------------------------------------------
  const pickImage = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return;
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.6,
      });
      if (!res.canceled && res.assets?.[0]?.uri) setPendingImage(res.assets[0].uri);
    } catch {}
  }, []);

  const quickPrompts = useMemo(
    () => QUICK_PROMPTS.map((p) => p[language as Lang] ?? p.ar),
    [language],
  );

  const symptomQuickChips = useMemo(
    () => SYMPTOM_QUICK_CHIPS.map((chip) => chip[language as Lang] ?? chip.ar),
    [language],
  );

  const send = useCallback(
    (raw: string, imageUri?: string | null) => {
      const text = normalizeSpeechText(raw).trim();
      const hasImg = !!imageUri;
      if ((!text && !hasImg) || thinking) return;

      const recentUserMessages = messages
        .filter((m) => m.role === 'user')
        .slice(-2)
        .map((m) => (m.role === 'user' ? m.text : ''))
        .filter(Boolean);

      // Loop breaker: `askCountRef` is the single source of truth for how many
      // clarifying questions we already asked, and `userTurnCount` is the hard
      // ceiling (from the user's 3rd message the engine must always answer).
      const askedSoFar = askCountRef.current;
      const forceAnswer = askedSoFar >= MAX_CLARIFY_ASKS;
      const userTurnCount = messages.filter((m) => m.role === 'user').length + 1;
      AsyncStorage.setItem('bodymap.lastAssistantVisit', String(Date.now())).catch(() => {});

      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: 'user', text: text || t('assistant.photoMessage'), imageUri: imageUri ?? undefined },
      ]);
      setInput('');
      setPendingImage(null);
      setThinking(true);
      if (replyTimerRef.current) clearTimeout(replyTimerRef.current);
      replyTimerRef.current = setTimeout(async () => {
        replyTimerRef.current = null;
        if (!mountedRef.current) return;
        try {
          // المسار الموحّد: نفس محرّك GlobalAssistant (Gemini + محرّك القواعد كخطة بديلة).
          // الصورة (إن وُجدت) تُحوَّل إلى data URL وتُمرَّر كمدخل متعدّد الوسائط لنفس المحرّك.
          const state = appStateRef.current ?? fallbackState(language as Lang);
          const imageData = hasImg && imageUri ? await toImageDataUrl(imageUri) : null;
          const turn = await interpretAsync(text, state, {
            previousContext: painContextRef.current ?? undefined,
            hasImage: hasImg,
            image: imageData,
            recentUserMessages,
            forceAnswer,
            askCount: askedSoFar,
            userTurnCount,
          });
          if (!mountedRef.current) return;

          for (const action of turn.actions) {
            if (action.type === 'reset_context') painContextRef.current = null;
            onActionRef.current?.(action);
          }
          if (turn.painContext) painContextRef.current = turn.painContext;
          else if (turn.mode === 'medical' && turn.medical?.painContext) painContextRef.current = turn.medical.painContext;

          const medical = turn.medical;
          const isMedical =
            turn.mode === 'medical' &&
            !!medical &&
            (medical.understood || medical.clarificationOnly ||
              medical.conditions.length > 0 || medical.organDetails.length > 0);
          const id = nextId();
          if (isMedical && medical) {
            // نعرض الردّ الموحّد في مقدّمة البطاقة + التفاصيل الطبية الغنية.
            const reply: AssistantReply = { ...medical, intro: turn.reply };
            if (reply.painContext) painContextRef.current = reply.painContext;
            const nextAskCount = reply.clarificationOnly ? askedSoFar + 1 : 0;
            askCountRef.current = nextAskCount;
            setAskCount(nextAskCount);
            setMessages((prev) => [...prev, { id, role: 'assistant', kind: 'rich', reply }]);
            voiceLog('assistant-response', { mode: 'medical', text: reply.intro?.[language as Lang]?.slice(0, 80) });
            setThinking(false);
            if (autoSpeak || voiceSessionRef.current) speak(replyToSpeech(reply), id);
          } else {
            // محادثة عامة / تحكّم: فقاعة نصية بسيطة (نفس سلوك GlobalAssistant).
            const replyText = turn.reply[language as Lang] ?? turn.reply.ar;
            askCountRef.current = 0;
            setAskCount(0);
            setMessages((prev) => [...prev, { id, role: 'assistant', kind: 'text', text: replyText }]);
            voiceLog('assistant-response', { mode: 'text', text: replyText.slice(0, 80) });
            setThinking(false);
            if (autoSpeak || voiceSessionRef.current) speak(replyText, id);
          }
        } catch (error) {
          console.error('[BodyMap Pain] assistant analysis error', error);
          if (mountedRef.current) setThinking(false);
        }
      }, 650);
    },
    [language, thinking, autoSpeak, speak, t, messages],
  );

  // نربط مرجع الإرسال بالدالة الفعلية لاستخدامه داخل مسار الصوت.
  sendRef.current = send;

  useEffect(() => {
    const context = initialContext?.trim();
    if (!context || initialContextSentRef.current) return;
    initialContextSentRef.current = true;
    // Defer one tick so the screen is mounted before the context is submitted.
    const timer = setTimeout(() => send(context), 0);
    return () => clearTimeout(timer);
  }, [initialContext, send]);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => scrollRef.current?.scrollToEnd({ animated: true }));
  }, []);

  // نبضة ناعمة لمؤشّر الاستماع (تصميم فقط — لا تمسّ منطق الصوت أو دورة الاستماع).
  const listeningPulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!listening) {
      listeningPulse.stopAnimation();
      listeningPulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(listeningPulse, {
        toValue: 1,
        duration: 1200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [listening, listeningPulse]);
  const pulseScale = listeningPulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 2.3] });
  const pulseOpacity = listeningPulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] });

  const canSend = (!!input.trim() || !!pendingImage) && !thinking;

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      {/* رأس المساعد */}
      <View style={[styles.agentBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.agentAvatar}>
          <Gradient colors={Gradients.brandSoft} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <Text style={styles.agentGlyph}>✦</Text>
        </View>
        <View style={[styles.agentMeta, { alignItems: rtl ? 'flex-end' : 'flex-start' }]}>
          <Text style={[styles.agentName, { color: colors.textPrimary }]}>{t('assistant.name')}</Text>
          <View style={[styles.statusRow, { flexDirection: row }]}>
            <View style={styles.statusDot} />
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>
              {t('assistant.status')}
              {askCount > 0 ? ` \u00b7 ${askCount}/${MAX_CLARIFY_ASKS}` : ''}
            </Text>
          </View>
        </View>
        <Pressable
          onPress={newConversation}
          accessibilityRole="button"
          accessibilityLabel={t('assistant.newConversation')}
          style={[styles.speakToggle, { borderColor: colors.border, backgroundColor: colors.backgroundAlt, marginEnd: 8 }]}
        >
          <Text style={styles.speakToggleGlyph}>✚</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            const next = !autoSpeak;
            setAutoSpeak(next);
            if (!next) {
              try { Speech.stop(); } catch {}
              setSpeakingId(null);
            }
          }}
          accessibilityRole="button"
          accessibilityLabel={t('assistant.autoSpeak')}
          style={[styles.speakToggle, { borderColor: colors.border, backgroundColor: autoSpeak ? Palette.teal100 : colors.backgroundAlt }]}
        >
          <Text style={styles.speakToggleGlyph}>{autoSpeak ? '🔊' : '🔇'}</Text>
        </Pressable>
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.flex}
        contentContainerStyle={styles.chatContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToEnd}
        keyboardShouldPersistTaps="handled"
      >
        {/* بطاقة ترحيب */}
        <View style={styles.welcomeCard}>
          <Gradient colors={Gradients.heroDeep} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <GlowOrb size={200} color={Palette.teal400} opacity={0.4} style={{ top: -80, right: -60 }} />
          <GlowOrb size={150} color={Palette.cyan} opacity={0.28} style={{ bottom: -70, left: -50 }} />
          <Text style={styles.welcomeTitle}>{t('assistant.welcomeTitle')}</Text>
          <Text style={styles.welcomeText}>{t('assistant.welcomeText')}</Text>
          <View style={[styles.privBadge, { flexDirection: row }]}>
            <Text style={styles.privGlyph}>🔒</Text>
            <Text style={styles.privText}>{t('assistant.privateBadge')}</Text>
          </View>
        </View>

        {messages.length === 0 && (
          <View style={styles.quickWrap}>
            {returningReminder && <Text style={[styles.clarify, { color: colors.textSecondary, textAlign: align }]}>{t('assistant.followUpReminder')}</Text>}
            <Text style={[styles.quickTitle, { color: colors.textSecondary, textAlign: align }]}>
              {t('assistant.tryThese')}
            </Text>
            {quickPrompts.map((prompt) => (
              <Pressable
                key={prompt}
                onPress={() => send(prompt)}
                accessibilityRole="button"
                accessibilityLabel={prompt}
                style={[styles.quickChip, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: row }]}
              >
                <Text style={styles.quickChipGlyph}>›</Text>
                <Text style={[styles.quickChipText, { color: colors.textPrimary, textAlign: align }]}>{prompt}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {messages.map((message) => {
          if (message.role === 'user') {
            return (
              <View key={message.id} style={[styles.userRow, { justifyContent: rtl ? 'flex-start' : 'flex-end' }]}>
                <View style={styles.userBubble}>
                  <Gradient colors={Gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
                  {message.imageUri && (
                    <Image source={{ uri: message.imageUri }} style={styles.userImage} resizeMode="cover" />
                  )}
                  <Text style={[styles.userText, { textAlign: align }]}>{message.text}</Text>
                </View>
              </View>
            );
          }
          if (message.kind === 'rich') {
            return (
              <AssistantBubble
                key={message.id}
                reply={message.reply}
                align={align}
                row={row}
                onOpenRegion={onOpenRegion}
                onOpenOrgan={onOpenOrgan}
                onSend={send}
                onSpeak={() => speak(replyToSpeech(message.reply), message.id)}
                speaking={speakingId === message.id}
                colors={colors}
                t={t}
              />
            );
          }
          return <SimpleBubble key={message.id} text={message.text} row={row} colors={colors} />;
        })}

        {messages.length > 0 && !thinking && (
          <View style={styles.quickWrap}>
            <Text style={[styles.quickTitle, { color: colors.textSecondary, textAlign: align }]}>{t('assistant.quickSymptoms')}</Text>
            <View style={[styles.chipRow, { flexDirection: row }]}>
              {symptomQuickChips.map((chip) => (
                <Pressable key={chip} onPress={() => send(chip)} style={[styles.symptomChip, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel={chip}>
                  <Text style={[styles.symptomChipText, { color: colors.textPrimary }]}>{chip}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {thinking && (
          <View style={[styles.agentRow, { flexDirection: row }]}>
            <View style={[styles.thinkingBubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <ActivityIndicator size="small" color={Palette.teal500} />
              <Text style={[styles.thinkingText, { color: colors.textSecondary }]}>{t('assistant.thinking')}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {/* شريط الإدخال */}
      <View style={[styles.inputWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        {voiceError && (
          <View style={[styles.voiceErrorRow, { flexDirection: row }]}>
            <Text style={styles.voiceErrorGlyph}>⚠️</Text>
            <Text style={[styles.voiceErrorText, { textAlign: align }]}>{t(`assistant.${voiceError}`)}</Text>
          </View>
        )}

        {pendingImage && (
          <View style={[styles.pendingRow, { flexDirection: row }]}>
            <View style={styles.pendingImageWrap}>
              <Image source={{ uri: pendingImage }} style={styles.pendingImage} resizeMode="cover" />
              <Pressable onPress={() => setPendingImage(null)} style={styles.pendingRemove} accessibilityRole="button" accessibilityLabel={t('assistant.removeImage')}>
                <Text style={styles.pendingRemoveGlyph}>✕</Text>
              </Pressable>
            </View>
          </View>
        )}

        {listening && (
          <View style={[styles.listeningBanner, { flexDirection: row }]}>
            <View style={styles.listeningDotWrap}>
              <Animated.View style={[styles.listeningPulse, { transform: [{ scale: pulseScale }], opacity: pulseOpacity }]} />
              <View style={styles.listeningDot} />
            </View>
            <Text style={[styles.listeningText, { textAlign: align }]} numberOfLines={2}>
              {interim || t('assistant.listening')}
            </Text>
          </View>
        )}

        <View style={[styles.inputBar, { flexDirection: row }]}>
          <Pressable
            onPress={pickImage}
            style={[styles.iconButton, { borderColor: colors.border, backgroundColor: colors.backgroundAlt }]}
            accessibilityRole="button"
            accessibilityLabel={t('assistant.attachImage')}
          >
            <Text style={styles.iconGlyph}>📷</Text>
          </Pressable>

          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={t('assistant.placeholder')}
            placeholderTextColor={colors.textLight}
            style={[styles.input, { color: colors.textPrimary, backgroundColor: colors.backgroundAlt, textAlign: align }]}
            multiline
            onSubmitEditing={() => send(input, pendingImage)}
            blurOnSubmit={false}
          />

          <Pressable
            onPress={toggleMic}
            style={[styles.iconButton, listening ? styles.micActive : { borderColor: colors.border, backgroundColor: colors.backgroundAlt }]}
            accessibilityRole="button"
            accessibilityLabel={listening ? t('assistant.voiceStop') : t('assistant.voiceInput')}
          >
            <Text style={styles.iconGlyph}>{listening ? '⏹' : '🎤'}</Text>
          </Pressable>

          <Pressable
            onPress={() => send(input, pendingImage)}
            disabled={!canSend}
            style={[styles.sendButton, !canSend && styles.sendDisabled]}
            accessibilityRole="button"
            accessibilityLabel={t('assistant.send')}
          >
            <Gradient colors={Gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Text style={styles.sendGlyph}>{rtl ? '◀' : '▶'}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
};

// ---------------------------------------------------------------------------
// فقاعة رد المساعد
// ---------------------------------------------------------------------------
interface BubbleProps {
  reply: AssistantReply;
  align: 'right' | 'left';
  row: 'row' | 'row-reverse';
  onOpenRegion: (regionId: string) => void;
  onOpenOrgan: (organId: string) => void;
  onSend: (text: string) => void;
  onSpeak: () => void;
  speaking: boolean;
  colors: typeof Colors;
  t: (key: Parameters<typeof translate>[1]) => string;
}

const AssistantBubble: React.FC<BubbleProps> = ({ reply, align, row, onOpenRegion, onOpenOrgan, onSend, onSpeak, speaking, colors, t }) => {
  const triage = TRIAGE_COLORS[reply.triage.level];
  const hasRedFlag = reply.redFlags.length > 0;

  return (
    <View style={[styles.agentRow, { flexDirection: row }]}>
      <View style={styles.agentMini}>
        <Gradient colors={Gradients.brandSoft} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Text style={styles.agentMiniGlyph}>✦</Text>
      </View>

      <View style={[styles.bubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.bubbleTop, { flexDirection: row }]}>
          <Text style={[styles.intro, { color: colors.textPrimary, textAlign: align, flex: 1 }]}>
            {reply.intro.ar && reply.intro[replyIntroLang(reply)]}
          </Text>
          <Pressable
            onPress={onSpeak}
            style={[styles.speakButton, { borderColor: colors.border, backgroundColor: speaking ? Palette.teal100 : colors.backgroundAlt }]}
            accessibilityRole="button"
            accessibilityLabel={t('assistant.speakReply')}
          >
            <Text style={styles.speakButtonGlyph}>{speaking ? '⏸' : '🔊'}</Text>
          </Pressable>
        </View>

        {reply.clarifyingQuestion && (
          <Text style={[styles.clarify, { color: colors.textSecondary, textAlign: align }]}>
            {reply.clarifyingQuestion[replyIntroLang(reply)]}
          </Text>
        )}

        {reply.understanding.length > 0 && (
          <View style={styles.understandBox}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, textAlign: align }]}>{t('assistant.understood')}</Text>
            {reply.understanding.map((line) => (
              <Text key={line} style={[styles.understandLine, { color: colors.textPrimary, textAlign: align }]}>• {line}</Text>
            ))}
          </View>
        )}

        {reply.clarificationOnly ? (
          <Text style={[styles.disclaimer, { color: colors.textLight, textAlign: align }]}>{reply.disclaimer[replyIntroLang(reply)]}</Text>
        ) : <>
        {/* أعضاء داخلية مذكورة — بطاقات تفصيلية */}
        {reply.organDetails.length > 0 && (
          <View style={styles.organsWrap}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, textAlign: align }]}>{t('assistant.organsDetected')}</Text>
            {reply.organDetails.map((organ) => (
              <View key={organ.id} style={[styles.organCard, { borderColor: colors.border, backgroundColor: colors.backgroundAlt }]}>
                <View style={[styles.organHead, { flexDirection: row }]}>
                  <Text style={[styles.organName, { color: colors.textPrimary, textAlign: align }]}>
                    {organ.label[replyIntroLang(reply)]}
                  </Text>
                  <View style={styles.organBadge}>
                    <Text style={styles.organBadgeText}>{t('assistant.internalOrgan')}</Text>
                  </View>
                </View>
                <Text style={[styles.organBlurb, { color: colors.textSecondary, textAlign: align }]}>
                  {organ.blurb[replyIntroLang(reply)]}
                </Text>
                {organ.location && (
                  <Text style={[styles.organLine, { color: colors.textPrimary, textAlign: align }]}>
                    <Text style={styles.organLineLabel}>{t('assistant.organLocation')}: </Text>
                    {organ.location}
                  </Text>
                )}
                {organ.symptoms && organ.symptoms.length > 0 && (
                  <View style={styles.organList}>
                    <Text style={[styles.organLineLabel, { color: colors.textSecondary, textAlign: align }]}>{t('assistant.organSymptoms')}</Text>
                    {organ.symptoms.map((s) => (
                      <Text key={s} style={[styles.organLine, { color: colors.textPrimary, textAlign: align }]}>• {s}</Text>
                    ))}
                  </View>
                )}
                {organ.causes && organ.causes.length > 0 && (
                  <View style={styles.organList}>
                    <Text style={[styles.organLineLabel, { color: colors.textSecondary, textAlign: align }]}>{t('assistant.organCauses')}</Text>
                    {organ.causes.map((c) => (
                      <Text key={c} style={[styles.organLine, { color: colors.textPrimary, textAlign: align }]}>• {c}</Text>
                    ))}
                  </View>
                )}
                {organ.warning && (
                  <View style={[styles.organWarnBox, { borderColor: triage.accent, backgroundColor: triage.bg }]}>
                    <Text style={[styles.organWarnText, { color: triage.fg, textAlign: align }]}>⚠ {organ.warning}</Text>
                  </View>
                )}
                {organ.recommendation && (
                  <Text style={[styles.organLine, { color: colors.textSecondary, textAlign: align }]}>
                    <Text style={styles.organLineLabel}>{t('assistant.organRecommendation')}: </Text>
                    {organ.recommendation}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {reply.medications.length > 0 && (
          <View style={styles.selfCareWrap}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, textAlign: align }]}>{t('assistant.medicationsDetected')}</Text>
            {reply.medications.map((medication) => (
              <View key={medication.id} style={[styles.organWarnBox, { borderColor: triage.accent, backgroundColor: triage.bg }]}>
                <Text style={[styles.organLine, { color: triage.fg, textAlign: align }]}>{medication.label[replyIntroLang(reply)]}</Text>
                <Text style={[styles.organWarnText, { color: triage.fg, textAlign: align }]}>{medication.caution[replyIntroLang(reply)]}</Text>
              </View>
            ))}
            {reply.medicationQuestion && <Text style={[styles.clarify, { color: colors.textSecondary, textAlign: align }]}>{reply.medicationQuestion[replyIntroLang(reply)]}</Text>}
          </View>
        )}

        {/* شارة الفرز */}
        <View style={[styles.triageBadge, { backgroundColor: triage.bg, flexDirection: row }]}>
          <View style={[styles.triageDot, { backgroundColor: triage.accent }]} />
          <Text style={[styles.triageTitle, { color: triage.fg, textAlign: align }]}>{reply.triage.title[replyIntroLang(reply)]}</Text>
        </View>
        <Text style={[styles.triageAdvice, { color: colors.textSecondary, textAlign: align }]}>{reply.triage.advice[replyIntroLang(reply)]}</Text>

        {reply.followUpQuestion && (
          <View style={styles.selfCareWrap}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, textAlign: align }]}>{reply.followUpQuestion[replyIntroLang(reply)]}</Text>
            <View style={[styles.chipRow, { flexDirection: row }]}>
              {reply.followUpOptions.slice(0, 3).map((option) => (
                <Pressable key={option.ar} onPress={() => onSend(option[replyIntroLang(reply)])} style={[styles.symptomChip, { backgroundColor: colors.backgroundAlt, borderColor: colors.border }]} accessibilityRole="button">
                  <Text style={[styles.symptomChipText, { color: colors.textPrimary }]}>{option[replyIntroLang(reply)]}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* علامات الإنذار */}
        {hasRedFlag && (
          <View style={[styles.redFlagBox, { borderColor: triage.accent, backgroundColor: triage.bg }]}>
            <Text style={[styles.redFlagTitle, { color: triage.fg, textAlign: align }]}>{t('assistant.redFlags')}</Text>
            {reply.redFlags.map((flag) => (
              <Text key={flag.id} style={[styles.redFlagLine, { color: triage.fg, textAlign: align }]}>⚠ {flag.label[replyIntroLang(reply)]}</Text>
            ))}
          </View>
        )}

        {/* أمراض محتملة — نسخة مبسّطة بدون أكواد ICD */}
        {reply.conditions.length > 0 && (
          <View style={styles.conditionsWrap}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, textAlign: align }]}>{t('assistant.possibleConditions')}</Text>
            {reply.conditions.map((condition) => {
              const { icon, name } = getSimpleCondition(condition.icd10, condition.name[replyIntroLang(reply)]);
              return (
                <View key={condition.id} style={[styles.conditionCard, { borderColor: colors.border, backgroundColor: colors.backgroundAlt }]}>
                  <View style={[styles.conditionHead, { flexDirection: row }]}>
                    <Text style={styles.conditionIcon}>{icon}</Text>
                    <Text style={[styles.conditionName, { color: colors.textPrimary, textAlign: align }]}>{name}</Text>
                  </View>
                  <Text style={[styles.conditionSummary, { color: colors.textSecondary, textAlign: align }]}>{condition.summary[replyIntroLang(reply)]}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* رعاية ذاتية */}
        {reply.selfCare.length > 0 && (
          <View style={styles.selfCareWrap}>
            <Text style={[styles.sectionLabel, { color: colors.textSecondary, textAlign: align }]}>{t('assistant.selfCare')}</Text>
            {reply.selfCare.map((tip) => (
              <Text key={tip} style={[styles.selfCareLine, { color: colors.textPrimary, textAlign: align }]}>✓ {tip}</Text>
            ))}
          </View>
        )}

        <Text style={[styles.whenToSee, { color: colors.textSecondary, textAlign: align }]}>
          {t('assistant.whenToSee')}: {reply.whenToSeeDoctor[replyIntroLang(reply)]}
        </Text>

        {reply.suggestedRegionId && (
          <Pressable
            onPress={() => onOpenRegion(reply.suggestedRegionId as string)}
            accessibilityRole="button"
            accessibilityLabel={t('assistant.openOnMap')}
            style={[styles.openMapButton, { flexDirection: row }]}
          >
            <Gradient colors={Gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Text style={styles.openMapText}>
              {t('assistant.openOnMap')}
              {reply.suggestedRegionLabel ? ` · ${reply.suggestedRegionLabel[replyIntroLang(reply)]}` : ''}
            </Text>
          </Pressable>
        )}

        {reply.suggestedOrganId && (
          <Pressable
            onPress={() => onOpenOrgan(reply.suggestedOrganId as string)}
            accessibilityRole="button"
            accessibilityLabel={t('assistant.openOrganOnMap')}
            style={[styles.openOrganButton, { flexDirection: row }]}
          >
            <Gradient colors={Gradients.brandSoft} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
            <Text style={styles.openOrganGlyph}>🫀</Text>
            <Text style={styles.openOrganText}>
              {t('assistant.openOrganOnMap')}
              {reply.suggestedOrganLabel ? ` · ${reply.suggestedOrganLabel[replyIntroLang(reply)]}` : ''}
            </Text>
          </Pressable>
        )}

        <Text style={[styles.disclaimer, { color: colors.textLight, textAlign: align }]}>{reply.disclaimer[replyIntroLang(reply)]}</Text>
        </>}
      </View>
    </View>
  );
};

// ---------------------------------------------------------------------------
// فقاعة ردّ نصية بسيطة (محادثة عامة / أوامر تحكّم) — نفس شكل GlobalAssistant
// ---------------------------------------------------------------------------
interface SimpleBubbleProps {
  text: string;
  row: 'row' | 'row-reverse';
  colors: typeof Colors;
}

const SimpleBubble: React.FC<SimpleBubbleProps> = ({ text, row, colors }) => (
  <View style={[styles.agentRow, { flexDirection: row }]}>
    <View style={styles.agentMini}>
      <Gradient colors={Gradients.brandSoft} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Text style={styles.agentMiniGlyph}>✦</Text>
    </View>
    <View style={[styles.bubble, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.intro, { color: colors.textPrimary }]}>{text}</Text>
    </View>
  </View>
);

/**
 * اختيار لغة نص الرد — نستخدم لغة الواجهة الحالية.
 */
function replyIntroLang(reply: AssistantReply): Lang {
  return reply.__lang ?? 'ar';
}

export default AssistantScreen;

const styles = StyleSheet.create({
  flex: { flex: 1 },
  agentBar: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  agentAvatar: {
    width: 44,
    height: 44,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...Elevation.glowTeal,
  },
  agentGlyph: { color: Palette.white, fontSize: 20, fontWeight: '900' },
  agentMeta: { flex: 1, gap: 2 },
  agentName: { fontFamily: Fonts.arabic.bold, fontSize: Type.title, fontWeight: Type.weight.black },
  statusRow: { alignItems: 'center', gap: 6 },
  statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Palette.mint },
  statusText: { fontFamily: Fonts.arabic.regular, fontSize: Type.micro },
  speakToggle: { width: 40, height: 40, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  speakToggleGlyph: { fontSize: 17 },
  chatContent: { padding: 16, paddingBottom: 22, gap: 14 },
  welcomeCard: {
    borderRadius: Radii.xl,
    padding: 18,
    overflow: 'hidden',
    ...Elevation.lg,
  },
  welcomeTitle: { color: Palette.white, fontFamily: Fonts.arabic.bold, fontSize: Type.h3, fontWeight: Type.weight.black, textAlign: 'right' },
  welcomeText: { color: '#D6ECEA', fontFamily: Fonts.arabic.regular, fontSize: Type.bodySm, lineHeight: 22, marginTop: 8, textAlign: 'right' },
  privBadge: { alignItems: 'center', gap: 6, marginTop: 12, alignSelf: 'flex-end', backgroundColor: 'rgba(255,255,255,0.14)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: Radii.pill },
  privGlyph: { fontSize: 12 },
  privText: { color: '#E4F5F2', fontFamily: Fonts.arabic.medium, fontSize: Type.micro },
  quickWrap: { gap: 9, marginTop: 2 },
  quickTitle: { fontFamily: Fonts.arabic.medium, fontSize: Type.caption, marginBottom: 2 },
  quickChip: { alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: Radii.md, paddingHorizontal: 13, paddingVertical: 11, ...Elevation.xs },
  quickChipGlyph: { color: Palette.teal500, fontSize: 18, fontWeight: '900' },
  quickChipText: { flex: 1, fontFamily: Fonts.arabic.medium, fontSize: Type.bodySm, lineHeight: 20 },
  chipRow: { flexWrap: 'wrap', gap: 7 },
  symptomChip: { borderWidth: 1, borderRadius: Radii.pill, paddingHorizontal: 10, paddingVertical: 7 },
  symptomChipText: { fontFamily: Fonts.arabic.medium, fontSize: Type.micro },
  userRow: { flexDirection: 'row' },
  userBubble: { maxWidth: '86%', borderRadius: Radii.lg, borderTopRightRadius: 6, paddingHorizontal: 14, paddingVertical: 11, overflow: 'hidden', gap: 8, ...Elevation.glowTeal },
  userImage: { width: 200, height: 200, borderRadius: Radii.md, alignSelf: 'flex-end' },
  userText: { color: Palette.white, fontFamily: Fonts.arabic.medium, fontSize: Type.body, lineHeight: 22 },
  agentRow: { alignItems: 'flex-start', gap: 9 },
  agentMini: { width: 30, height: 30, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginTop: 2 },
  agentMiniGlyph: { color: Palette.white, fontSize: 14, fontWeight: '900' },
  bubble: { flex: 1, borderRadius: Radii.lg, borderTopLeftRadius: 6, borderWidth: 1, padding: 14, gap: 10, ...Elevation.sm },
  bubbleTop: { alignItems: 'flex-start', gap: 8 },
  intro: { fontFamily: Fonts.arabic.bold, fontSize: Type.body, lineHeight: 23, fontWeight: Type.weight.bold },
  speakButton: { width: 34, height: 34, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  speakButtonGlyph: { fontSize: 15 },
  clarify: { fontFamily: Fonts.arabic.regular, fontSize: Type.bodySm, lineHeight: 21 },
  understandBox: { gap: 4 },
  sectionLabel: { fontFamily: Fonts.arabic.bold, fontSize: Type.micro, letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 3 },
  understandLine: { fontFamily: Fonts.arabic.regular, fontSize: Type.bodySm, lineHeight: 21 },
  triageBadge: { alignItems: 'center', gap: 8, borderRadius: Radii.md, paddingHorizontal: 12, paddingVertical: 9 },
  triageDot: { width: 9, height: 9, borderRadius: 5 },
  triageTitle: { flex: 1, fontFamily: Fonts.arabic.bold, fontSize: Type.bodySm, fontWeight: Type.weight.black },
  triageAdvice: { fontFamily: Fonts.arabic.regular, fontSize: Type.bodySm, lineHeight: 21 },
  redFlagBox: { borderWidth: 1.5, borderRadius: Radii.md, padding: 11, gap: 4 },
  redFlagTitle: { fontFamily: Fonts.arabic.bold, fontSize: Type.bodySm, fontWeight: Type.weight.black, marginBottom: 2 },
  redFlagLine: { fontFamily: Fonts.arabic.medium, fontSize: Type.bodySm, lineHeight: 21 },
  conditionsWrap: { gap: 8 },
  conditionCard: { borderWidth: 1, borderRadius: Radii.md, padding: 11, gap: 5 },
  conditionHead: { alignItems: 'center', gap: 8 },
  conditionIcon: { fontSize: 22 },
  conditionName: { flex: 1, fontFamily: Fonts.arabic.bold, fontSize: Type.bodySm, fontWeight: Type.weight.bold },
  conditionSummary: { fontFamily: Fonts.arabic.regular, fontSize: Type.caption, lineHeight: 19 },
  selfCareWrap: { gap: 5 },
  selfCareLine: { fontFamily: Fonts.arabic.regular, fontSize: Type.bodySm, lineHeight: 21 },
  whenToSee: { fontFamily: Fonts.arabic.medium, fontSize: Type.caption, lineHeight: 19 },
  openMapButton: { alignItems: 'center', justifyContent: 'center', borderRadius: Radii.md, paddingVertical: 12, paddingHorizontal: 16, overflow: 'hidden', ...Elevation.glowTeal },
  openMapText: { color: Palette.white, fontFamily: Fonts.arabic.bold, fontSize: Type.bodySm, fontWeight: Type.weight.black },
  organsWrap: { gap: 8 },
  organCard: { borderWidth: 1, borderRadius: Radii.md, padding: 12, gap: 6 },
  organHead: { alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  organName: { flex: 1, fontFamily: Fonts.arabic.bold, fontSize: Type.body, fontWeight: Type.weight.black },
  organBadge: { backgroundColor: Palette.teal100, borderRadius: Radii.xs, paddingHorizontal: 7, paddingVertical: 2 },
  organBadgeText: { color: Palette.teal700, fontFamily: Fonts.arabic.bold, fontSize: Type.micro },
  organBlurb: { fontFamily: Fonts.arabic.regular, fontSize: Type.caption, lineHeight: 19 },
  organList: { gap: 3, marginTop: 2 },
  organLine: { fontFamily: Fonts.arabic.regular, fontSize: Type.caption, lineHeight: 19 },
  organLineLabel: { fontFamily: Fonts.arabic.bold, fontSize: Type.micro },
  organWarnBox: { borderWidth: 1.5, borderRadius: Radii.sm, padding: 9, marginTop: 3 },
  organWarnText: { fontFamily: Fonts.arabic.medium, fontSize: Type.caption, lineHeight: 19 },
  openOrganButton: { alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: Radii.md, paddingVertical: 12, paddingHorizontal: 16, overflow: 'hidden', ...Elevation.sm },
  openOrganGlyph: { fontSize: 15 },
  openOrganText: { color: Palette.white, fontFamily: Fonts.arabic.bold, fontSize: Type.bodySm, fontWeight: Type.weight.black },
  disclaimer: { fontFamily: Fonts.arabic.regular, fontSize: Type.micro, lineHeight: 16, marginTop: 2 },
  thinkingBubble: { flexDirection: 'row', alignItems: 'center', gap: 9, borderWidth: 1, borderRadius: Radii.lg, paddingHorizontal: 14, paddingVertical: 11 },
  thinkingText: { fontFamily: Fonts.arabic.medium, fontSize: Type.bodySm },
  inputWrap: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 22 : 12, borderTopWidth: 1, gap: 8 },
  pendingRow: { alignItems: 'center', gap: 10 },
  pendingImageWrap: { position: 'relative' },
  pendingImage: { width: 56, height: 56, borderRadius: Radii.md },
  pendingRemove: { position: 'absolute', top: -6, right: -6, width: 22, height: 22, borderRadius: 11, backgroundColor: Palette.rose, alignItems: 'center', justifyContent: 'center' },
  pendingRemoveGlyph: { color: Palette.white, fontSize: 12, fontWeight: '900' },
  listeningBanner: { alignItems: 'center', gap: 12, backgroundColor: Palette.teal50, borderWidth: 1, borderColor: Palette.teal200, borderRadius: Radii.lg, paddingHorizontal: 14, paddingVertical: 11 },
  listeningDotWrap: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center' },
  listeningPulse: { position: 'absolute', width: 18, height: 18, borderRadius: 9, backgroundColor: Palette.rose },
  listeningDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Palette.rose },
  listeningText: { flex: 1, color: Palette.teal700, fontFamily: Fonts.arabic.medium, fontSize: Type.bodySm, lineHeight: 20 },
  voiceErrorRow: { alignItems: 'flex-start', gap: 8, backgroundColor: Colors.dangerLight, borderWidth: 1, borderColor: '#FBD5D5', borderRadius: Radii.md, paddingHorizontal: 12, paddingVertical: 9 },
  voiceErrorGlyph: { fontSize: 14, marginTop: 1 },
  voiceErrorText: { flex: 1, color: Colors.danger, fontFamily: Fonts.arabic.medium, fontSize: Type.caption, lineHeight: 18 },
  inputBar: { alignItems: 'flex-end', gap: 9 },
  iconButton: { width: 46, height: 46, borderRadius: Radii.md, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  iconGlyph: { fontSize: 19 },
  micActive: { backgroundColor: Palette.rose, borderWidth: 1, borderColor: Palette.rose, shadowColor: Palette.rose, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 14, elevation: 8 },
  input: { flex: 1, minHeight: 46, maxHeight: 120, borderRadius: Radii.md, paddingHorizontal: 14, paddingVertical: 11, fontFamily: Fonts.arabic.regular, fontSize: Type.body },
  sendButton: { width: 46, height: 46, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', ...Elevation.glowTeal },
  sendDisabled: { opacity: 0.4 },
  sendGlyph: { color: Palette.white, fontSize: 16, fontWeight: '900' },
});
