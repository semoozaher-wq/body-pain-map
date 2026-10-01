// tests/voicePipeline.test.cjs
// ============================================================================
// اختبارات قبول خط أنابيب الصوت (A–H) + فحوص الربط (wiring) — عبر node --test.
// تُشغّل tests/voicePipeline.runner.ts (عبر tsx) الذي يقود الوحدات الحقيقية،
// ثم تتحقّق من السلوك المتوقّع، وتتحقّق أيضًا من أنّ الشاشة/الخطّاف يُمرّران
// منطق النصّ الصوتي إلى services/speech/turnGate.ts (لا نسخة مكرّرة داخلية).
// ============================================================================
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const RUNNER = path.join('tests', 'voicePipeline.runner.ts');

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
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

// ---------------------------------------------------------------------------
// A — جملة واحدة ⇒ جولة واحدة عبر التسلسل الكامل (لا إرسال مزدوج).
// ---------------------------------------------------------------------------
test('Arabic speech quality picks a useful alternative and normalizes common dialect spelling', () => {
  const a = data.ArabicSpeechQuality;
  assert.strictEqual(a.normalized, 'ظهري بيوجعني');
  assert.strictEqual(a.picked, 'وجع في ظهري');
  assert.strictEqual(a.snapshot, 'وجع في ظهري');
});

test('A. one utterance produces exactly one turn (interim→final→onend→silence)', () => {
  const a = data.A;
  assert.strictEqual(a.turnCount, 1, 'exactly one turn');
  assert.deepStrictEqual(a.turns, ['ظهرى بيوجعنى'], 'the full utterance is sent once');
  // ثلاث لقطات (جزئية، جزئية متراكمة، نهائية) ⇒ لم يُسقط النصّ ولم يُكرّر.
  assert.strictEqual(a.snaps.length, 3, 'three recogniser snapshots reached the gate');
  assert.strictEqual(a.snaps[2], 'ظهرى بيوجعنى', 'final snapshot is the full utterance');
  // إفراغ onend بعد إفراغ الصمت يجب أن يكون فارغًا (لا جولة ثانية).
  assert.ok(a.emptyCommits >= 1, 'the onend flush had nothing left to send');
});

// ---------------------------------------------------------------------------
// B — إعادة التصحيح على أندرويد: لا إرسال مرّتين لنفس الجملة داخل النافذة.
// ---------------------------------------------------------------------------
test('B. Android re-finalisation of the same utterance is deduped', () => {
  const b = data.B;
  assert.strictEqual(b.turnCount, 1, 'the repeated final is not re-sent');
  assert.deepStrictEqual(b.turns, ['ظهرى بيوجعنى']);
  assert.strictEqual(b.deduped, true, 'the dedup window fired (turn-dedup)');
});

// ---------------------------------------------------------------------------
// C — نموذج الإلحاق: يُرسل الفرق فقط (لا تكرار للبادئة).
// ---------------------------------------------------------------------------
test('C. append model sends only the delta (no prefix duplication)', () => {
  const c = data.C;
  assert.strictEqual(c.turnCount, 2, 'two distinct turns');
  assert.deepStrictEqual(c.turns, ['ظهرى', 'تحت شويه'], 'second turn is only the new part');
});

// ---------------------------------------------------------------------------
// D — نموذج الاستبدال: الجملة الجديدة لا تُبتلع.
// ---------------------------------------------------------------------------
test('D. replace model does not swallow the new utterance', () => {
  const d = data.D;
  assert.strictEqual(d.turnCount, 2, 'two distinct turns');
  assert.deepStrictEqual(d.turns, ['ظهرى', 'تحت شويه']);
});

// ---------------------------------------------------------------------------
// E — شكوى بمنطقة مسمّاة: علامة بلا استجواب موقع ولا سؤال شدّة مبكّر.
// ---------------------------------------------------------------------------
test('E. named-region complaint marks the map without a questionnaire or premature severity', () => {
  const e = data.E;
  assert.ok(e.length >= 3, 'several named-region complaints covered');
  for (const c of e) {
    assert.strictEqual(c.understood, true, `${c.name} understood`);
    assert.strictEqual(c.hasSetMarker, true, `${c.name} places a marker`);
    assert.ok(String(c.setMarkerTarget).startsWith('region:'), `${c.name} marker is a real region`);
    // لا استجواب موقع (السؤال القديم).
    assert.strictEqual(c.hasWhereExactly, false, `${c.name} must not ask "فين بالظبط"`);
    // لا سؤال شدّة مبكّر من الطبقة الطبية.
    assert.strictEqual(c.hasSeverityWord, false, `${c.name} must not ask severity`);
    assert.strictEqual(c.hasSeverityScale, false, `${c.name} must not ask the 0–10 scale`);
    assert.strictEqual(c.hasQuestionMark, false, `${c.name} reply is not a question`);
  }
});

// ---------------------------------------------------------------------------
// F — «نفس المكان» ⇒ keep_marker: تبقى العلامة ولا يُعاد السؤال.
// ---------------------------------------------------------------------------
test('F. "same place" keeps the marker without re-asking', () => {
  const f = data.F;
  assert.ok(f.length >= 3, 'several keep-marker phrasings covered');
  for (const c of f) {
    assert.strictEqual(c.hasKeepMarker, true, `${c.utterance} ⇒ keep_marker intent`);
    assert.strictEqual(c.hasLocatePain, false, `${c.utterance} must not be a fresh locate_pain`);
    assert.strictEqual(c.understood, true, `${c.utterance} understood`);
    assert.strictEqual(c.mentionsSamePlace, true, `${c.utterance} confirms the same place`);
    assert.strictEqual(c.reAsksLocation, false, `${c.utterance} must not re-ask the location`);
    // لا تحريك للعلامة (لا set_marker/move_marker) — فقط إبراز العنصر المرجعي إن وُجد.
    assert.ok(!c.actions.some((a) => a.type === 'move_marker'), `${c.utterance} must not move the marker`);
    assert.ok(!c.actions.some((a) => a.type === 'set_marker'), `${c.utterance} must not re-place the marker`);
  }
  // مع مرجع صالح ⇒ يُبرز العنصر المرجعي.
  assert.ok(f[0].actions.some((a) => a.type === 'highlight'), 'highlights the referenced region');
});

// ---------------------------------------------------------------------------
// G — تطبيع النصّ (تشكيل/مسافات/صور الألف) + دلالة الفرق.
// ---------------------------------------------------------------------------
test('G. transcript normalisation is diacritic/whitespace/alef-insensitive', () => {
  const g = data.G;
  for (const c of g.sameUtterance) {
    assert.strictEqual(c.actual, c.expected, `sameUtterance(${JSON.stringify(c.a)}, ${JSON.stringify(c.b)})`);
  }
  for (const c of g.normalize) assert.strictEqual(c.actual, c.expected, `normalize(${JSON.stringify(c.input)})`);
  for (const c of g.strip) assert.strictEqual(c.actual, c.expected, `strip(${JSON.stringify(c.input)})`);
  for (const c of g.collapse) assert.strictEqual(c.actual, c.expected, `collapse(${JSON.stringify(c.input)})`);
  for (const c of g.delta) {
    assert.strictEqual(c.actualText, c.text, `delta text (${JSON.stringify(c.committed)} | ${JSON.stringify(c.live)})`);
    assert.strictEqual(c.actualReplaced, c.replaced, `delta replaced (${JSON.stringify(c.committed)} | ${JSON.stringify(c.live)})`);
  }
});

// ---------------------------------------------------------------------------
// H — تعرّف الويب يُسقط الأحداث المتطابقة حرفيًا.
// ---------------------------------------------------------------------------
test('H. web speech recogniser drops exact duplicate result events', () => {
  const h = data.H;
  assert.strictEqual(h.resultCount, 2, 'the literal repeat event is dropped');
  assert.deepStrictEqual(h.snaps, ['ظهرى', 'ظهرى بيوجعنى'], 'only distinct snapshots reach the gate');
  assert.strictEqual(h.dedupEvents, 1, 'one speech-result-dedup logged');
});

// ---------------------------------------------------------------------------
// I — دمج نص التعرف الأصلي (native) ضد التكرار (انحدار Android/Expo).
//     نفس حالات tests/nativeSpeechTranscriptMerge.regression.ts.
// ---------------------------------------------------------------------------
test('I. native transcript merge drops duplicates and cumulative re-sends', () => {
  const i = data.I;
  assert.strictEqual(i.pass, true, `merged value was: ${i.value}`);
  assert.strictEqual(i.value, 'عندي وجع في بطني', 'duplicates dropped, new segment appended once');
});

// ---------------------------------------------------------------------------
// J — سباق onend→restart: نفس الجملة النهائية لا تُرسَل مرّتين؛ الجديدة لا تُبتلع.
// ---------------------------------------------------------------------------
test('J. onend→restart race: same final is not re-sent, a new utterance is not swallowed', () => {
  const j = data.J;
  assert.strictEqual(j.sameUtteranceTurns, 1, 'the re-finalised utterance across restart yields one turn');
  assert.strictEqual(j.finalDeduped, true, 'the cross-restart final-dedup fired (turn-final-dedup)');
  assert.strictEqual(j.newUtteranceTurns, 1, 'a genuinely new utterance after restart is still sent');
  assert.deepStrictEqual(j.turns, ['عندي وجع في بطني', 'عندي صداع'], 'exactly the two distinct utterances');
});

// ---------------------------------------------------------------------------
// K — مسار صوتي واحد فقط: بثّ نفس الحدث إلى مسارين ⇒ جولة واحدة فقط.
// ---------------------------------------------------------------------------
test('K. only one active voice listener: a broadcast event yields a single turn', () => {
  const k = data.K;
  assert.strictEqual(k.aClaimed, true, 'the assistant screen claims the mic session');
  assert.strictEqual(k.bClaimed, false, 'the always-mounted floating assistant cannot claim it');
  assert.strictEqual(k.ownerWhileListening, 'assistant', 'the assistant screen owns the mic');
  assert.strictEqual(k.aTurns, 1, 'the owning pipeline produces exactly one turn');
  assert.strictEqual(k.bTurnsWhileAOwns, 0, 'the non-owning pipeline produces no turn (no duplicate)');
  assert.strictEqual(k.bClaimedAfterRelease, true, 'after release the other pipeline may take over');
  assert.strictEqual(k.bTurnsAfterOwnership, 1, 'and then it works normally');
});

// ---------------------------------------------------------------------------
// L — دمج التداخل الجزئي: جزء من الكلام داخل نصّ جديد لا يُكرّره.
// ---------------------------------------------------------------------------
test('L. mergeSpeechTranscript handles partial-overlap fragments without duplication', () => {
  const l = data.L;
  assert.ok(Array.isArray(l) && l.length >= 6, 'has the overlap cases');
  for (const c of l) {
    assert.strictEqual(c.pass, true, `merge("${c.prev}","${c.next}") => "${c.actual}" expected "${c.expected}"`);
  }
});

// ---------------------------------------------------------------------------
// M — حالات إزالة التكرار على البوّابة.
// ---------------------------------------------------------------------------
test('M. TurnGate dedups duplicate final, interim→final, and repeated onresult', () => {
  const m = data.M;
  assert.strictEqual(m.duplicateFinalTurns, 1, 'a literal duplicate final yields one turn');
  assert.strictEqual(m.interimToFinalTurns, 1, 'interim→final yields one turn');
  assert.strictEqual(m.interimToFinalText, 'عندي وجع في بطني', 'the full utterance is sent');
  assert.strictEqual(m.repeatedOnresultTurns, 1, 'a repeated onresult snapshot yields one turn');
});

// ---------------------------------------------------------------------------
// N — TTS مرّة واحدة: تيّار أحداث واقعي ⇒ جولة واحدة ⇒ نطق واحد.
// ---------------------------------------------------------------------------
test('N. a realistic event stream (duplicate final + onend + restart) speaks exactly once', () => {
  const n = data.N;
  assert.strictEqual(n.turnCount, 1, 'exactly one turn');
  assert.strictEqual(n.speakCount, 1, 'exactly one TTS invocation');
  assert.deepStrictEqual(n.turns, ['عندي وجع في بطني'], 'one utterance only');
});

// ---------------------------------------------------------------------------
// Wiring — قفل الجلسة المفردة مربوط في المسارين + GlobalAssistant يُعطّل العائم.
// ---------------------------------------------------------------------------
test('Wiring: single voice-session lock is enforced in both pipelines', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'services/speech/voiceSession.ts')), 'voiceSession.ts exists');
  const lock = read('services/speech/voiceSession.ts');
  assert.match(lock, /claimVoiceSession/, 'exposes claimVoiceSession');
  assert.match(lock, /isVoiceSessionOwner/, 'exposes isVoiceSessionOwner');

  const hook = read('hooks/useAppAssistant.ts');
  const screen = read('screens/AssistantScreen.tsx');
  for (const [name, src] of [['hook', hook], ['screen', screen]]) {
    assert.match(src, /claimVoiceSession/, `${name} claims the mic session`);
    assert.match(src, /releaseVoiceSession/, `${name} releases the mic session`);
    assert.match(src, /isVoiceSessionOwner/, `${name} guards its listeners by ownership`);
  }
  // المساعد العائم يُعطّى صوتيًا أثناء عرض الشاشة الكاملة.
  assert.match(read('components/GlobalAssistant.tsx'), /enabled:\s*!hidden/, 'GlobalAssistant disables the pipeline when hidden');
  // حارس النصّ النهائي عبر إعادة التشغيل + جلسة جديدة على البوّابة.
  const gate = read('services/speech/turnGate.ts');
  assert.match(gate, /turn-final-dedup/, 'turnGate logs turn-final-dedup');
  assert.match(gate, /newSession/, 'turnGate exposes newSession()');
});

// ---------------------------------------------------------------------------
// Wiring — الخطّاف والشاشة يُمرّران المنطق إلى TurnGate (لا نسخة مكرّرة).
// ---------------------------------------------------------------------------
test('Wiring: hook and screen delegate voice bookkeeping to TurnGate', () => {
  const hook = read('hooks/useAppAssistant.ts');
  const screen = read('screens/AssistantScreen.tsx');

  for (const [name, src] of [['hook', hook], ['screen', screen]]) {
    assert.match(src, /createTurnGate/, `${name} imports createTurnGate`);
    assert.match(src, /getGate\(\)/, `${name} funnels events through getGate()`);
    // لا بقايا من المنطق المكرّر القديم.
    assert.ok(!/scheduleTurnSend\s*\(/.test(src), `${name} has no leftover scheduleTurnSend()`);
    assert.ok(!/commitTurnRef/.test(src), `${name} has no leftover commitTurnRef`);
    assert.ok(!/silenceTimerRef/.test(src), `${name} has no leftover silenceTimerRef`);
  }
});

test('Wiring: TurnGate/transcript modules exist and webSpeech has event-level dedup', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'services/speech/turnGate.ts')), 'turnGate.ts exists');
  assert.ok(fs.existsSync(path.join(ROOT, 'services/speech/transcript.ts')), 'transcript.ts exists');
  assert.match(read('services/speech/webSpeech.ts'), /speech-result-dedup/, 'webSpeech logs speech-result-dedup');
  assert.match(read('services/speech/webSpeech.ts'), /lastLiveText/, 'webSpeech tracks lastLiveText');
});

test('Wiring: keep_marker intent + engine case exist; old questionnaire removed', () => {
  const intents = read('services/appAssistant/intents.ts');
  const engine = read('services/appAssistant/engine.ts');
  assert.match(intents, /keep_marker/, 'intents declares keep_marker');
  assert.match(intents, /KEEP_MARKER_PHRASES/, 'intents has KEEP_MARKER_PHRASES');
  assert.match(engine, /case 'keep_marker'/, 'engine handles keep_marker');
  // السؤال القديم «فوق، تحت، يمين، شمال» يجب أن يكون قد أُزيل من مسار locate_pain.
  assert.ok(!engine.includes('فوق، تحت، يمين، شمال'), 'old direction questionnaire removed');
});

test('Sanity: referenced region ids used by the tests exist in the catalog', () => {
  assert.strictEqual(data.catalogSanity.upperBackExists, true);
  assert.strictEqual(data.catalogSanity.absFrontExists, true);
});
