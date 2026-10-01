// tests/ttsVoice.test.cjs
// ============================================================================
// Regression tests for the NATURAL VOICE (TTS) fix — via node --test.
// Runs tests/ttsVoice.runner.ts (through tsx) which drives the real pure unit
// services/speech/ttsVoice.ts and asserts on the JSON it emits:
//   • the best available voice is chosen per language (natural > robotic),
//   • voices of the wrong language are never selected,
//   • prosody (rate/pitch) is tuned to natural, non-robotic values,
//   • text is cleaned before speaking (markdown / emoji / urls / bullets).
// ============================================================================
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const RUNNER = path.join('tests', 'ttsVoice.runner.ts');

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

test('a natural/neural voice scores higher than a robotic one', () => {
  assert.ok(data.scores.google > data.scores.robotic, `google=${data.scores.google} robotic=${data.scores.robotic}`);
  assert.ok(data.scores.naturalOtherRegion > data.scores.robotic);
});

test('a voice of a different language is rejected (negative score)', () => {
  assert.ok(data.scores.wrongLang < 0, `wrongLang=${data.scores.wrongLang}`);
});

test('best voice per language prefers the natural/cloud voice', () => {
  assert.strictEqual(data.picks.ar, 'ar-eg-google');
  assert.strictEqual(data.picks.en, 'en-us-google');
  assert.strictEqual(data.picks.fr, 'fr-fr-siri');
});

test('no same-language voice => null (never pick a wrong-language voice)', () => {
  assert.strictEqual(data.picks.none, null);
  assert.strictEqual(data.picks.empty, null);
});

test('prosody is natural and non-robotic (pitch neutral, Arabic slightly slower)', () => {
  assert.strictEqual(data.prosody.ar.pitch, 1);
  assert.ok(data.prosody.ar.rate < 1, `ar.rate=${data.prosody.ar.rate}`);
  assert.strictEqual(data.prosody.en.pitch, 1);
  assert.strictEqual(data.prosody.en.rate, 1);
  assert.strictEqual(data.prosody.fr.pitch, 1);
});

test('TTS text is cleaned before speaking (markdown / emoji / urls / bullets)', () => {
  assert.strictEqual(data.prepared.markdown, 'ألم شديد في الرجل');
  assert.strictEqual(data.prepared.emoji, 'عندك ألم؟');
  assert.strictEqual(data.prepared.url, 'شوف دلوقتي');
  assert.strictEqual(data.prepared.link, 'اقرأ التعليمات الأول');
  assert.strictEqual(data.prepared.bullets, 'نقطة نقطة تانية');
  assert.strictEqual(data.prepared.plain, 'عندي ألم في الرجل');
});

test('TTS language mapping matches the UI language', () => {
  assert.strictEqual(data.ttsLang.ar, 'ar-EG');
  assert.strictEqual(data.ttsLang.en, 'en-US');
  assert.strictEqual(data.ttsLang.fr, 'fr-FR');
  assert.strictEqual(data.ttsLang.other, 'ar-EG');
});
