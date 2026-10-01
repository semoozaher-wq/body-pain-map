// tests/textRepetition.test.cjs
// ============================================================================
// Regression tests for the assistant TYPING / repetition fix — via node --test.
// Runs tests/textRepetition.runner.ts (through tsx) which drives the real units
// and asserts on the JSON it emits.
//   • consecutive word/phrase repetition is collapsed (STT / paste / typing),
//   • the SHARED normalisation (typing + voice) removes the repeats,
//   • voice transcript merging stays idempotent,
//   • assistant replies carry exactly ONE follow-up question and no repeats,
//   • follow-up phrasing is gender-neutral (no «تقدر/تقدري»),
//   • switching voice <-> typing never re-introduces repetition.
// ============================================================================
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const RUNNER = path.join('tests', 'textRepetition.runner.ts');

function runRunner() {
  const res = spawnSync('npx', ['tsx', RUNNER], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  assert.strictEqual(res.status, 0, `runner exited with ${res.status}: ${res.stderr}`);
  const out = (res.stdout || '').trim();
  assert.ok(out.length > 0, 'runner produced no output');
  return JSON.parse(out);
}

const data = runRunner();

// ---------------------------------------------------------------------------
// 1) collapseRepeatedSegments — the root cause.
// ---------------------------------------------------------------------------
test('collapseRepeatedSegments removes consecutive repeated words/phrases', () => {
  for (const c of data.collapse) {
    assert.strictEqual(c.output, c.expected, `collapse(${JSON.stringify(c.input)}) = ${JSON.stringify(c.output)}`);
  }
  // The exact example from the bug report.
  const example = data.collapse.find((c) => c.input === 'نص الرجل نص الرجل نص الرجل');
  assert.strictEqual(example.output, 'نص الرجل', '«نص الرجل نص الرجل نص الرجل» -> «نص الرجل»');
  const example2 = data.collapse.find((c) => c.input === 'من وقت من وقت من وقت');
  assert.strictEqual(example2.output, 'من وقت', '«من وقت من وقت من وقت» -> «من وقت»');
});

test('collapseRepeatedSegments leaves normal sentences untouched', () => {
  const normal = data.collapse.find((c) => c.input === 'عندي وجع في الرجل');
  assert.strictEqual(normal.output, 'عندي وجع في الرجل');
  const single = data.collapse.find((c) => c.input === 'كلمة');
  assert.strictEqual(single.output, 'كلمة');
});

// ---------------------------------------------------------------------------
// 2) Shared normalisation (typing + voice) collapses repeats + fixes spelling.
// ---------------------------------------------------------------------------
test('normalizeSpeechText (shared typing+voice path) collapses repeats', () => {
  for (const c of data.normalize) {
    assert.strictEqual(c.output, c.expected, `normalize(${JSON.stringify(c.input)}) = ${JSON.stringify(c.output)}`);
  }
});

// ---------------------------------------------------------------------------
// 3) Voice transcript merging stays idempotent and repeat-free.
// ---------------------------------------------------------------------------
test('mergeSpeechTranscript never keeps intra-string repetition', () => {
  for (const c of data.merge) {
    assert.strictEqual(c.output, c.expected, `merge(${JSON.stringify(c.prev)}, ${JSON.stringify(c.next)}) = ${JSON.stringify(c.output)}`);
  }
});

// ---------------------------------------------------------------------------
// 4) Reply hygiene — exactly one follow-up question.
// ---------------------------------------------------------------------------
test('enforceSingleQuestion keeps at most one question per message', () => {
  for (const c of data.singleQuestion) {
    assert.strictEqual(c.output, c.expected, `enforceSingleQuestion(${JSON.stringify(c.input)}) = ${JSON.stringify(c.output)}`);
    assert.ok(c.outputQuestionCount <= 1, `at most one question in ${JSON.stringify(c.output)}`);
  }
});

test('cleanAssistantReply collapses repeats in every language', () => {
  assert.strictEqual(data.cleanReply.ar, 'وجع');
  assert.strictEqual(data.cleanReply.en, 'pain');
  assert.strictEqual(data.cleanReply.fr, 'douleur');
});

// ---------------------------------------------------------------------------
// 5) Neutral follow-up phrasing.
// ---------------------------------------------------------------------------
test('follow-up questions are gender-neutral (no «تقدر/تقدري»)', () => {
  assert.strictEqual(data.gendered, false, `no gendered phrasing in ${JSON.stringify(data.followUps)}`);
  assert.strictEqual(data.followUps.location, 'مكان الألم بالظبط فين؟');
  assert.strictEqual(data.followUps.severity, 'شدة الألم من 1 لـ 10، كام؟');
  for (const [key, value] of Object.entries(data.followUps)) {
    assert.ok(/[؟?]/.test(value), `${key} follow-up is a question: ${value}`);
  }
});

// ---------------------------------------------------------------------------
// 6) Manual typing + voice<->typing transitions.
// ---------------------------------------------------------------------------
test('manual typing is normalised through the shared path', () => {
  assert.strictEqual(data.manualTyping.sent, 'ظهري بيوجعني', 'typed repeats collapse and spelling is fixed');
});

test('voice -> typing transition never re-introduces repetition', () => {
  assert.strictEqual(data.voiceToTyping.mergedVoice, 'نص الرجل');
  assert.strictEqual(data.voiceToTyping.thenTyped, 'من وقت');
  assert.strictEqual(data.voiceToTyping.combined, 'نص الرجل من وقت');
});
