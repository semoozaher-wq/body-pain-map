// services/speech/turnGate.ts
// ============================================================================
// TurnGate — guarantees ONE user utterance produces exactly ONE assistant turn.
// ----------------------------------------------------------------------------
// Root cause it fixes
//   The web (Web Speech API) and native (expo-speech-recognition) paths each
//   carried their own copy of "liveRef / committedRef / currentRef" bookkeeping
//   plus a silence debounce. Duplicated across hooks/useAppAssistant.ts and
//   screens/AssistantScreen.tsx, they drifted and double-sent a turn whenever
//   the same utterance surfaced as interim -> final -> onend -> silence, or when
//   Android re-finalised / replaced `event.results`.
//
//   TurnGate centralises that bookkeeping so both call sites delegate to one
//   implementation with one, tested invariant:
//
//       within a session, the text already committed is never sent twice,
//       and a genuinely new utterance is never swallowed.
//
// Model
//   • `committed`  — the cumulative transcript already turned into a turn.
//   • `pending`    — the not-yet-sent remainder (what the UI shows live).
//   • `ingest()`   — feed a cumulative live transcript; recomputes `pending`
//                    from `committed`, and (re)schedules the silence commit.
//   • `flush()`    — commit immediately (used on recogniser `end`).
//   • `reset()`    — start a brand-new session.
//
//   Timers are injectable so the behaviour is deterministic under test.
// ============================================================================

import { collapseWhitespace, deltaFromCommitted, normalizeTranscript } from './transcript';

export interface TurnGateSnapshot {
  liveText: string;
  hasFinal: boolean;
}

export interface TurnGateOptions {
  /** Silence (ms) after the last result before a turn is emitted. */
  silenceMs?: number;
  /** Two identical utterances closer than this are treated as one (re-finalisation). */
  dedupWindowMs?: number;
  /**
   * Two identical *final* transcripts closer than this are treated as one, even
   * across a recogniser restart (onend→start). Survives reset() so Android's
   * re-finalisation in the new session does not re-send the same utterance.
   */
  finalDedupWindowMs?: number;
  /** Live display text (pending remainder). */
  onInterim?: (text: string) => void;
  /** A real utterance to send. Called at most once per utterance. */
  onTurn: (text: string) => void;
  /** Commit fired with nothing to send (e.g. recogniser end after a send). */
  onEmpty?: () => void;
  /** Structured diagnostics (mirrors voiceLog stages). */
  onLog?: (stage: string, data?: Record<string, unknown>) => void;
  /** Injectable timers (defaults to globalThis). */
  setTimeoutFn?: (fn: () => void, ms: number) => any;
  clearTimeoutFn?: (handle: any) => void;
  now?: () => number;
}

export interface TurnGate {
  /**
   * Restart the recogniser within the SAME session: clears committed/pending and
   * any timer, but KEEPS the cross-restart final-dedup guard so a re-finalised
   * utterance after onend→start is not sent twice.
   */
  reset(): void;
  /** Start a brand-new conversation: like reset() but also clears the final-dedup guard. */
  newSession(): void;
  /** Feed a cumulative live transcript; returns the current pending remainder. */
  ingest(liveText: string, hasFinal: boolean): string;
  /** Convenience wrapper for a SpeechSnapshot. */
  onSnapshot(snap: TurnGateSnapshot): string;
  /** Feed a final transcript (native path); same semantics as ingest(). */
  onFinal(text: string): string;
  /** Commit the pending remainder immediately (e.g. on recogniser `end`). */
  flush(): void;
  /** Current not-yet-sent remainder. */
  pending(): string;
  /** Cumulative transcript already sent. */
  committed(): string;
  /** True while a silence commit is scheduled. */
  isScheduled(): boolean;
  /** Clear the timer without committing (used on user-initiated stop). */
  dispose(): void;
}

export const DEFAULT_TURN_SILENCE_MS = 1500;
export const DEFAULT_DEDUP_WINDOW_MS = 1200;
export const DEFAULT_FINAL_DEDUP_WINDOW_MS = 2500;

export function createTurnGate(options: TurnGateOptions): TurnGate {
  const silenceMs = options.silenceMs ?? DEFAULT_TURN_SILENCE_MS;
  const dedupWindowMs = options.dedupWindowMs ?? DEFAULT_DEDUP_WINDOW_MS;
  const finalDedupWindowMs = options.finalDedupWindowMs ?? DEFAULT_FINAL_DEDUP_WINDOW_MS;
  const setTimeoutFn =
    options.setTimeoutFn ?? ((fn: () => void, ms: number) => setTimeout(fn, ms));
  const clearTimeoutFn = options.clearTimeoutFn ?? ((handle: any) => clearTimeout(handle));
  const now = options.now ?? (() => Date.now());
  const log = options.onLog ?? (() => {});

  let live = '';
  let committed = '';
  let pending = '';
  let timer: any = null;
  let lastTurnText = '';
  let lastTurnAt = 0;
  // Cross-restart final-dedup guard (survives reset(); cleared only by newSession()).
  let lastFinalText = '';
  let lastFinalAt = 0;

  function clearTimer(): void {
    if (timer != null) {
      clearTimeoutFn(timer);
      timer = null;
    }
  }

  function schedule(): void {
    clearTimer();
    timer = setTimeoutFn(() => {
      timer = null;
      commit();
    }, silenceMs);
  }

  function commit(): void {
    clearTimer();
    const text = pending.trim();
    if (!text) {
      log('turn-empty');
      options.onEmpty?.();
      return;
    }
    const norm = normalizeTranscript(text);
    if (norm && norm === lastTurnText && now() - lastTurnAt < dedupWindowMs) {
      // Same utterance already sent moments ago (Android re-finalisation).
      log('turn-dedup', { text });
      committed = live;
      pending = '';
      options.onInterim?.('');
      return;
    }
    committed = live;
    pending = '';
    lastTurnText = norm;
    lastTurnAt = now();
    options.onInterim?.('');
    log('sendTurn', { text });
    options.onTurn(text);
  }

  function ingest(liveText: string, hasFinal: boolean): string {
    live = collapseWhitespace(liveText);
    const delta = deltaFromCommitted(committed, live);
    if (delta.replaced) committed = '';
    if (delta.text) {
      pending = delta.text;
      options.onInterim?.(pending);
      schedule();
    }
    // When there is no new text we deliberately keep any pending remainder and
    // its timer, so a duplicate interim/final event neither loses the turn nor
    // schedules a spurious empty commit.
    log('transcript', { live, pending, hasFinal });
    return pending;
  }

  function resetState(clearFinal: boolean): void {
    clearTimer();
    live = '';
    committed = '';
    pending = '';
    lastTurnText = '';
    lastTurnAt = 0;
    if (clearFinal) {
      lastFinalText = '';
      lastFinalAt = 0;
    }
  }

  return {
    reset(): void {
      // Restart within the same session: keep the final-dedup guard so a
      // re-finalised utterance after onend→start is not sent a second time.
      resetState(false);
    },
    newSession(): void {
      resetState(true);
    },
    ingest,
    onSnapshot(snap: TurnGateSnapshot): string {
      return ingest(snap.liveText, snap.hasFinal);
    },
    onFinal(text: string): string {
      // Cross-restart guard: Android re-finalises the same utterance in the new
      // session (after reset()), so dedup identical finals within the window.
      const norm = normalizeTranscript(text);
      if (norm && norm === lastFinalText && now() - lastFinalAt < finalDedupWindowMs) {
        log('turn-final-dedup', { text });
        return pending;
      }
      lastFinalText = norm;
      lastFinalAt = now();
      return ingest(text, true);
    },
    flush(): void {
      clearTimer();
      commit();
    },
    pending(): string {
      return pending;
    },
    committed(): string {
      return committed;
    },
    isScheduled(): boolean {
      return timer != null;
    },
    dispose(): void {
      clearTimer();
    },
  };
}
