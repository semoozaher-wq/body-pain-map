// services/speech/webSpeech.ts
// ============================================================================
// Robust Web Speech API wrapper for BodyMap Pain (web / PWA / Android Chrome).
// ----------------------------------------------------------------------------
// Why this exists
//   Chrome on Android reports `isFinal === true` for *interim* results as well
//   as final ones (a long-standing Web Speech API quirk). Code that trusts
//   `isFinal` alone therefore:
//     • never shows a live transcript (interim branch never runs), and
//     • can keep only the first partial of a sentence and drop the rest,
//       because Android often *replaces* `event.results` instead of appending.
//
//   This wrapper rebuilds the transcript from scratch on every event and
//   classifies each result using BOTH `isFinal` and `confidence`
//   (interim results carry confidence 0). It therefore behaves correctly on
//   desktop Chrome, Android Chrome and Android WebView, and is immune to the
//   "append vs replace" difference in `event.results`.
// ============================================================================

export interface SpeechSnapshot {
  /** Text confirmed as final so far in this recognition session. */
  finalText: string;
  /** Text still being refined (interim). */
  interimText: string;
  /** finalText + interimText — everything heard so far. */
  liveText: string;
  /** True when the latest event contained at least one final result. */
  hasFinal: boolean;
}

export interface RecognizerCallbacks {
  onStart?: () => void;
  onSpeechStart?: () => void;
  onResult?: (snapshot: SpeechSnapshot) => void;
  onSpeechEnd?: () => void;
  onEnd?: () => void;
  onError?: (code: string, message?: string) => void;
  log?: (stage: string, data?: Record<string, unknown>) => void;
}

export interface RecognizerOptions {
  lang: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

export interface WebRecognizer {
  start(): void;
  stop(): void;
  abort(): void;
  isRunning(): boolean;
  getLiveText(): string;
}

/** Returns the browser's SpeechRecognition constructor, or null when missing. */
export function getWebRecognitionCtor(): any | null {
  if (typeof globalThis === 'undefined') return null;
  const w = globalThis as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function webSpeechSupported(): boolean {
  return !!getWebRecognitionCtor();
}

/**
 * Heuristic: are we inside an in-app WebView (Facebook / Instagram / WhatsApp /
 * TikTok / Messenger / generic Android WebView)? Those usually expose the mic
 * permission but silently never deliver speech results.
 */
export function isLikelyInAppBrowser(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|TikTok|Twitter|GSA\/|; wv\)/i.test(ua);
}

/**
 * A result counts as *final* only when the browser says so AND it is not one of
 * Android's fake-final interim results (which carry confidence 0).
 */
function isFinalResult(result: any, confidence: number | null): boolean {
  if (!result || !result.isFinal) return false;
  if (confidence === 0) return false;
  return true;
}

/** Rebuild a clean transcript snapshot from a SpeechRecognitionEvent. */
export function snapshotFromEvent(event: any): SpeechSnapshot {
  const results = event && event.results ? event.results : null;
  const n = results ? results.length : 0;
  let finalText = '';
  let interimText = '';
  let hasFinal = false;
  for (let i = 0; i < n; i++) {
    const result = results[i];
    const alt = result && (result[0] || result[event.resultIndex]);
    const transcript = (alt && alt.transcript) || '';
    if (!transcript) continue;
    const confidence = alt && typeof alt.confidence === 'number' ? alt.confidence : null;
    if (isFinalResult(result, confidence)) {
      finalText += `${transcript} `;
      hasFinal = true;
    } else {
      interimText += transcript;
    }
  }
  finalText = finalText.replace(/\s+/g, ' ').trim();
  interimText = interimText.replace(/\s+/g, ' ').trim();
  const liveText = `${finalText} ${interimText}`.trim();
  return { finalText, interimText, liveText, hasFinal };
}

export function createWebRecognizer(
  options: RecognizerOptions,
  callbacks: RecognizerCallbacks,
): WebRecognizer | null {
  const Ctor = getWebRecognitionCtor();
  if (!Ctor) {
    callbacks.log?.('no-speech-api');
    callbacks.onError?.('no-speech-api');
    return null;
  }

  const rec = new Ctor();
  rec.lang = options.lang;
  rec.continuous = options.continuous ?? true;
  rec.interimResults = options.interimResults ?? true;
  rec.maxAlternatives = options.maxAlternatives ?? 1;

  let running = false;
  let liveText = '';

  rec.onstart = () => {
    running = true;
    liveText = '';
    callbacks.log?.('mic-start', { lang: rec.lang, continuous: rec.continuous, interimResults: rec.interimResults });
    callbacks.onStart?.();
  };
  rec.onaudiostart = () => callbacks.log?.('audio-start');
  rec.onspeechstart = () => {
    callbacks.log?.('speech-start');
    callbacks.onSpeechStart?.();
  };
  rec.onspeechend = () => {
    callbacks.log?.('speech-end');
    callbacks.onSpeechEnd?.();
  };
  rec.onresult = (event: any) => {
    const snap = snapshotFromEvent(event);
    liveText = snap.liveText;
    callbacks.log?.('speech-result', {
      results: event?.results?.length ?? 0,
      resultIndex: event?.resultIndex,
      finalText: snap.finalText,
      interimText: snap.interimText,
      liveText: snap.liveText,
    });
    callbacks.onResult?.(snap);
  };
  rec.onerror = (event: any) => {
    running = false;
    const code = (event && event.error) || 'speech-error';
    callbacks.log?.('speech-error', { code, message: event?.message });
    callbacks.onError?.(code, event?.message);
  };
  rec.onend = () => {
    running = false;
    callbacks.log?.('mic-end');
    callbacks.onEnd?.();
  };

  return {
    start() {
      try {
        rec.start();
      } catch (e: any) {
        callbacks.log?.('start-failed', { name: e?.name, message: e?.message });
        callbacks.onError?.(e?.name === 'InvalidStateError' ? 'already-started' : 'start-failed', e?.message);
      }
    },
    stop() {
      try {
        rec.stop();
      } catch {
        /* ignore */
      }
    },
    abort() {
      try {
        rec.abort();
      } catch {
        /* ignore */
      }
    },
    isRunning() {
      return running;
    },
    getLiveText() {
      return liveText;
    },
  };
}
