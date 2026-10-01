// tests/textRepetition.runner.ts
// ============================================================================
// Regression runner for the assistant TYPING / repetition fix.
// ----------------------------------------------------------------------------
// Emits a single JSON object on stdout so tests/textRepetition.test.cjs can
// assert on it via `node --test`. It drives the REAL units (no re-implementation):
//   • services/speech/transcript.ts   (collapseRepeatedSegments, merge)
//   • services/speech/arabicSpeech.ts (normalizeSpeechText — shared path)
//   • services/appAssistant/engine.ts (enforceSingleQuestion, cleanAssistantReply)
//   • services/aiAssistant/engine.ts  (buildSmartFollowUp — neutral phrasing)
// ============================================================================

import { collapseRepeatedSegments, mergeSpeechTranscript } from '../services/speech/transcript';
import { normalizeSpeechText } from '../services/speech/arabicSpeech';
import { enforceSingleQuestion, cleanAssistantReply } from '../services/appAssistant/engine';
import { buildSmartFollowUp, type PainContext } from '../services/aiAssistant/engine';

// ---------------------------------------------------------------------------
// 1) collapseRepeatedSegments — the root-cause fix for repeated words/phrases.
// ---------------------------------------------------------------------------
const collapseCases: Array<[string, string]> = [
  ['نص الرجل نص الرجل نص الرجل', 'نص الرجل'],
  ['من وقت من وقت من وقت', 'من وقت'],
  ['وجع وجع وجع في الرجل', 'وجع في الرجل'],
  ['عندي وجع في الرجل', 'عندي وجع في الرجل'],
  ['ضهري بيوجعني ضهري بيوجعني', 'ضهري بيوجعني'],
  ['أنا عندي وجع في الرجل وجع في الرجل', 'أنا عندي وجع في الرجل'],
  ['وجع، وجع، وجع', 'وجع،'],
  ['كلمة', 'كلمة'],
  ['', ''],
];

const collapse = collapseCases.map(([input, expected]) => ({
  input,
  expected,
  output: collapseRepeatedSegments(input),
}));

// ---------------------------------------------------------------------------
// 2) normalizeSpeechText — the SHARED path used by BOTH typing and voice.
// ---------------------------------------------------------------------------
const normalizeCases: Array<[string, string]> = [
  ['ضهري بيوجعني ضهري بيوجعني', 'ظهري بيوجعني'],
  ['نص الرجل نص الرجل نص الرجل', 'نص الرجل'],
  ['من وقت من وقت من وقت', 'من وقت'],
  ['راس راس راس', 'رأس'],
  ['  وجع   وجع   وجع  ', 'وجع'],
];

const normalize = normalizeCases.map(([input, expected]) => ({
  input,
  expected,
  output: normalizeSpeechText(input),
}));

// ---------------------------------------------------------------------------
// 3) mergeSpeechTranscript — voice transcript merging must not keep repeats.
// ---------------------------------------------------------------------------
const mergeCases: Array<[string, string, string]> = [
  ['', 'نص الرجل نص الرجل نص الرجل', 'نص الرجل'],
  ['عندي وجع', 'في الرجل في الرجل', 'عندي وجع في الرجل'],
  ['ظهري بيوجعني', 'ظهري بيوجعني', 'ظهري بيوجعني'],
  ['وجع في الرجل', 'وجع في الرجل', 'وجع في الرجل'],
  ['من وقت', 'من وقت من وقت', 'من وقت'],
];

const merge = mergeCases.map(([prev, next, expected]) => ({
  prev,
  next,
  expected,
  output: mergeSpeechTranscript(prev, next),
}));

// ---------------------------------------------------------------------------
// 4) Reply hygiene — exactly ONE follow-up question, no repeated words.
// ---------------------------------------------------------------------------
const replyCases: Array<[string, string]> = [
  ['تمام. إيه شدة الألم؟ إيه اللي بيزوّد الألم؟', 'تمام. إيه شدة الألم؟'],
  ['فهمت، ألم في البطن بقاله يومين.', 'فهمت، ألم في البطن بقاله يومين.'],
  ['إيه شدة الألم؟', 'إيه شدة الألم؟'],
  ['تمام، سجّلت الألم في الساق. إيه شدة الألم؟', 'تمام، سجّلت الألم في الساق. إيه شدة الألم؟'],
  ['إيه شدة الألم؟ إيه شدة الألم؟', 'إيه شدة الألم؟'],
];

const singleQuestion = replyCases.map(([input, expected]) => ({
  input,
  expected,
  output: enforceSingleQuestion(input),
  questionCount: (input.match(/[؟?]/g) || []).length,
  outputQuestionCount: (enforceSingleQuestion(input).match(/[؟?]/g) || []).length,
}));

const cleanReply = cleanAssistantReply({
  ar: 'وجع وجع وجع',
  en: 'pain pain pain',
  fr: 'douleur douleur douleur',
});

// ---------------------------------------------------------------------------
// 5) Neutral follow-up phrasing (no gendered «تقدر/تقدري»).
// ---------------------------------------------------------------------------
const baseCtx: PainContext = {
  painLocation: null,
  painLocationLabel: null,
  painOnset: null,
  painDuration: null,
  painSeverity: null,
  painQuality: [],
  radiation: false,
  aggravatingFactors: [],
  relievingFactors: [],
  associatedSymptoms: [],
  injury: false,
  medications: [],
  redFlags: [],
  userCorrections: [],
};

const followUpLocation = buildSmartFollowUp({ ...baseCtx, painLocation: null });
const followUpSeverity = buildSmartFollowUp({ ...baseCtx, painLocation: 'leg', painSeverity: null });
const followUpDuration = buildSmartFollowUp({ ...baseCtx, painLocation: 'leg', painSeverity: 6, painDuration: null });
const followUpQuality = buildSmartFollowUp({ ...baseCtx, painLocation: 'leg', painSeverity: 6, painDuration: 'يومين', painQuality: [] });
const followUpRadiation = buildSmartFollowUp({ ...baseCtx, painLocation: 'leg', painSeverity: 6, painDuration: 'يومين', painQuality: ['شد'], radiation: false });

const followUps = {
  location: followUpLocation?.ar ?? null,
  severity: followUpSeverity?.ar ?? null,
  duration: followUpDuration?.ar ?? null,
  quality: followUpQuality?.ar ?? null,
  radiation: followUpRadiation?.ar ?? null,
};
const gendered = /تقدر|تقدري|تقدري/.test(Object.values(followUps).join(' '));

// ---------------------------------------------------------------------------
// 6) Manual typing vs voice→typing transitions (end-to-end through the shared path).
// ---------------------------------------------------------------------------
const manualTyping = {
  // What AssistantScreen.send()/useAppAssistant.send() do with a typed message.
  typed: 'ضهري بيوجعني ضهري بيوجعني ضهري بيوجعني',
  sent: normalizeSpeechText('ضهري بيوجعني ضهري بيوجعني ضهري بيوجعني'),
};

const voiceToTyping = {
  // 1) voice result arrives duplicated, 2) merged, 3) then the user types more.
  rawVoice: 'نص الرجل نص الرجل نص الرجل',
  mergedVoice: mergeSpeechTranscript('', normalizeSpeechText('نص الرجل نص الرجل نص الرجل')),
  thenTyped: normalizeSpeechText('من وقت من وقت من وقت'),
  combined: mergeSpeechTranscript(
    mergeSpeechTranscript('', normalizeSpeechText('نص الرجل نص الرجل نص الرجل')),
    normalizeSpeechText('من وقت من وقت من وقت'),
  ),
};

console.log(JSON.stringify({ collapse, normalize, merge, singleQuestion, cleanReply, followUps, gendered, manualTyping, voiceToTyping }));
