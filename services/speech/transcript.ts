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
    .replace(/\u0629/g, '\u0647') // ta marbuta -> ha
    // Common Egyptian speech-recognition spelling of ظهر. This is only used
    // for equality/deduplication, never for the displayed transcript or
    // location inference.
    .replace(/\u0636\u0647\u0631/g, '\u0638\u0647\u0631');
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

/**
 * Comparison key used only for repeat detection: like {@link normalizeTranscript}
 * but with trailing punctuation stripped so «الرجل،» and «الرجل» count as the
 * same word (STT and users sprinkle commas between repeated fragments).
 */
function repeatKey(token: string): string {
  return normalizeTranscript(token).replace(/[.,،؛;:!؟?]+$/g, '');
}

/** True when norm[a..a+len) equals norm[b..b+len). */
function blocksEqual(norm: string[], a: number, b: number, len: number): boolean {
  for (let k = 0; k < len; k++) {
    if (norm[a + k] !== norm[b + k]) return false;
  }
  return true;
}

/**
 * Collapse consecutive repeated words/phrases inside a single string.
 *
 * This is the root-cause fix for the «نص الرجل نص الرجل نص الرجل» class of bug.
 * Speech recognisers (and users pasting/typing) sometimes emit the same word or
 * phrase back-to-back. {@link mergeSpeechTranscript} only removes overlap
 * *between* two strings; this helper removes repeats *within* one string. It is
 * intentionally conservative: it only drops a block when the exact same block
 * repeats immediately after itself, so normal sentences are never touched.
 *
 *   collapseRepeatedSegments('نص الرجل نص الرجل نص الرجل') -> 'نص الرجل'
 *   collapseRepeatedSegments('من وقت من وقت من وقت')        -> 'من وقت'
 *   collapseRepeatedSegments('وجع وجع وجع في الرجل')         -> 'وجع في الرجل'
 *   collapseRepeatedSegments('عندي وجع في الرجل')            -> 'عندي وجع في الرجل'
 *
 * Comparison is diacritic/whitespace/punctuation-insensitive, so «ضهري ضهري»
 * and «ظهري ظهري» both collapse. The first occurrence (original spelling) is
 * always the one kept.
 */
export function collapseRepeatedSegments(text: string): string {
  const tokens = collapseWhitespace(text).split(' ').filter(Boolean);
  if (tokens.length < 2) return tokens.join(' ');
  // Guard against pathological inputs: the scan below is O(n^3) worst case.
  if (tokens.length > 400) return tokens.join(' ');
  const norm = tokens.map(repeatKey);
  const out: string[] = [];
  let i = 0;
  while (i < tokens.length) {
    let matched = false;
    const remaining = tokens.length - i;
    for (let block = 1; block * 2 <= remaining; block++) {
      // Count how many times the block starting at `i` repeats consecutively.
      let reps = 1;
      let j = i + block;
      while (j + block <= tokens.length && blocksEqual(norm, i, j, block)) {
        reps += 1;
        j += block;
      }
      if (reps >= 2) {
        for (let k = 0; k < block; k++) out.push(tokens[i + k]);
        i += block * reps;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out.push(tokens[i]);
      i += 1;
    }
  }
  return out.join(' ');
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
  // Collapse intra-string repeats first so a recogniser that re-sends the same
  // word/phrase inside one result cannot leak «نص الرجل نص الرجل» downstream.
  const p = collapseRepeatedSegments(prev);
  const n = collapseRepeatedSegments(next);
  if (!n) return p;
  if (!p) return n;
  const np = normalizeTranscript(p);
  const nn = normalizeTranscript(n);
  if (np === nn) return p; // إعادة تثبيت حرفية لنفس الجملة

  // دمج قائم على الرموز مع كشف التداخل: نجد أكبر عدد من الكلمات المتطابقة بين
  // نهاية النص السابق وبداية النص الجديد، ثم نُلحق الجزء غير المتداخل فقط.
  // هذا يغطّي ثلاث حالات دفعة واحدة:
  //   • النص التراكمي الكامل (nn يبدأ بـ np)      ⇒ يُعاد n كما هو
  //   • المقطع موجود في الذيل (np ينتهي بـ nn)     ⇒ تبقى p كما هي
  //   • وصول جزء من الكلام داخل نص جديد (تداخل جزئي) ⇒ لا يتكرّر الجزء المشترك
  const pt = tokenizeSpeech(p);
  const nt = tokenizeSpeech(n);
  const maxK = Math.min(pt.length, nt.length);
  let overlap = 0;
  for (let k = maxK; k >= 1; k--) {
    const a = pt.slice(pt.length - k).map(normalizeTranscript).join(' ');
    const b = nt.slice(0, k).map(normalizeTranscript).join(' ');
    if (a === b) {
      overlap = k;
      break;
    }
  }
  if (overlap > 0) return collapseRepeatedSegments([...pt, ...nt.slice(overlap)].join(' '));
  return collapseRepeatedSegments(`${p} ${n}`); // مقطع جديد فعلًا (لا تداخل)
}
