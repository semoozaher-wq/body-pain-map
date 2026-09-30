// services/speech/voiceLog.ts
// ============================================================================
// Temporary, dependency-free STT diagnostics.
// ----------------------------------------------------------------------------
// Logs every stage of the voice pipeline to the console AND keeps the last 200
// entries on `window.__voiceLog`, so a tester can copy the real device trace
// (e.g. from Android Chrome via chrome://inspect) without a debugger.
// Stages: mic-start, audio-start, speech-start, speech-result, transcript,
//         speech-end, mic-end, sendTurn, assistant-response, error…
// ============================================================================

export interface VoiceLogEntry {
  t: number;
  stage: string;
  data?: Record<string, unknown>;
}

const MAX_ENTRIES = 200;

function store(): VoiceLogEntry[] {
  if (typeof window === 'undefined') return [];
  const w = window as any;
  if (!Array.isArray(w.__voiceLog)) w.__voiceLog = [];
  return w.__voiceLog as VoiceLogEntry[];
}

export function voiceLog(stage: string, data?: Record<string, unknown>): void {
  const entry: VoiceLogEntry = { t: Date.now(), stage, data };
  try {
    const arr = store();
    arr.push(entry);
    if (arr.length > MAX_ENTRIES) arr.splice(0, arr.length - MAX_ENTRIES);
  } catch {
    /* ignore */
  }
  try {
    // eslint-disable-next-line no-console
    console.log(`[voice] ${stage}`, data ?? '');
  } catch {
    /* ignore */
  }
}

export function getVoiceLog(): VoiceLogEntry[] {
  return store().slice();
}

export function clearVoiceLog(): void {
  if (typeof window === 'undefined') return;
  (window as any).__voiceLog = [];
}
