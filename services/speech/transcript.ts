// services/speech/transcript.ts
// ============================================================================
// Pure transcript helpers for the voice pipeline (normalisation + dedup).
// ----------------------------------------------------------------------------
// Why this exists
//   Speech recognisers (especially Android Chrome) are noisy: the same utterance
//   can arrive as interim -> final -> onend -> silence, and Android often
//   *re-finalises* the same text or *replaces* `event.results` instead of
//   appending. Comparing raw strings therefore either double-sends a turn or
//   swallows a real one.
//
//   These helpers give the pipeline a single, testable notion of "the same
//   utterance" (diacritic/whitespace-insensitive) and a robust way to compute
//   the *new* part of a cumulative transcript without ever re-sending a prefix
//   that was already committed.
//
//   No DOM, no timers, no side effects -> trivially unit-testable.
// ============================================================================

/** Collapse runs of whitespace and trim. */
export function collapseWhitespace(text: string): string {
  return (text || '').replace(/\s+/g, ' ').trim();
}

/**
 * Remove Arabic diacritics (harakat), tatweel, and unify the common letter
 * variants that recognisers emit inconsistently (أ/إ/آ -> ا, ى -> ي, ة -> ه).
 * This is intentionally identical in spirit to the app-catalog normaliser so
 * the speech layer and the intent layer agree on what "the same word" means.
 */
export function stripArabicDiacritics(text: string): string {
  return (text || '')
    .replace(/[\u064B-\u0652\u0670\u0640]/g, '') // harakat + tatweel
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627') // alef variants -> alef
    .replace(/\u0649/g, '\u064A') // alef maqsura -> ya
    .replace(/\u0629/g, '\u0647'); // ta marbuta -> ha
}

/** Canonical form used for equality / prefix comparisons. */
export function normalizeTranscript(text: string): string {
  return collapseWhitespace(stripArabicDiacritics((text || '').toLowerCase()));
}

/** Split a transcript into whitespace-delimited tokens (raw, not normalised). */
export function tokenizeSpeech(text: string): string[] {
  return collapseWhitespace(text).split(' ').filter(Boolean);
}

/** True when two transcripts are the same utterance after normalisation. */
export function sameUtterance(a: string, b: string): boolean {
  const na = normalizeTranscript(a);
  const nb = normalizeTranscript(b);
  return !!na && na === nb;
}

export interface DeltaResult {
  /** The new (not-yet-committed) text. Empty when the live text adds nothing. */
  text: string;
  /** True when the recogniser replaced its buffer (live no longer extends committed). */
  replaced: boolean;
}

/**
 * Compute the new part of `live` relative to what was already `committed`.
 *
 *   deltaFromCommitted('', 'ظهرى بيوجعنى')      -> { text: 'ظهرى بيوجعنى', replaced: false }
 *   deltaFromCommitted('ظهرى', 'ظهرى بيوجعنى')  -> { text: 'بيوجعنى', replaced: false }
 *   deltaFromCommitted('ظهرى بيوجعنى', 'ظهرى')  -> { text: 'ظهرى', replaced: true }
 *   deltaFromCommitted('ظهرى', 'تحت شويه')      -> { text: 'تحت شويه', replaced: true }
 *
 * Comparison is token-wise and diacritic-insensitive, so Android's cosmetic
 * re-spellings of the already-committed prefix do not produce a phantom delta.
 */
export function deltaFromCommitted(committed: string, live: string): DeltaResult {
  const l = collapseWhitespace(live);
  const c = collapseWhitespace(committed);
  if (!c) return { text: l, replaced: false };
  if (!l) return { text: '', replaced: false };

  const ct = tokenizeSpeech(c);
  const lt = tokenizeSpeech(l);
  if (lt.length < ct.length) return { text: l, replaced: true };

  const prefixMatches = ct.every(
    (tok, i) => normalizeTranscript(tok) === normalizeTranscript(lt[i]),
  );
  if (prefixMatches) return { text: lt.slice(ct.length).join(' '), replaced: false };
  return { text: l, replaced: true };
}

/**
 * Safely merge an incoming (native) transcript fragment into the running
 * transcript for the current session, dropping Android's duplicated text.
 *
 * Android/Expo often *re-finalises* the same utterance, or *re-sends the whole
 * cumulative transcript* instead of only the new words. Naive concatenation
 * (`prev + next`) therefore doubles the speech. This helper keeps the merge
 * idempotent:
 *
 *   mergeSpeechTranscript('', 'عندي وجع')                        -> 'عندي وجع'
 *   mergeSpeechTranscript('عندي وجع', 'في بطني')                 -> 'عندي وجع في بطني'
 *   mergeSpeechTranscript('عندي وجع في بطني', 'في بطني')         -> 'عندي وجع في بطني'   (tail already present)
 *   mergeSpeechTranscript('عندي وجع في بطني', 'عندي وجع في بطني') -> 'عندي وجع في بطني'  (literal repeat)
 *
 * Always returns a string (never null). A duplicate simply yields the previous
 * value unchanged, so callers can detect "no change" by comparing the result
 * with the collapsed previous text.
 */
export function mergeSpeechTranscript(prev: string, next: string): string {
  const p = collapseWhitespace(prev);
  const n = collapseWhitespace(next);
  if (!n) return p;
  if (!p) return n;
  const np = normalizeTranscript(p);
  const nn = normalizeTranscript(n);
  if (np === nn) return p; // إعادة تثبيت حرفية لنفس الجملة
  if (nn.startsWith(`${np} `)) return n; // المتعرّف أعاد النص التراكمي كاملًا
  if (np.endsWith(` ${nn}`)) return p; // المقطع موجود بالفعل في الذيل
  return `${p} ${n}`; // مقطع جديد فعلًا
}
