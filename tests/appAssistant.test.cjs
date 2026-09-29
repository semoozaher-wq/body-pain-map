// tests/appAssistant.test.cjs
// ============================================================================
// اختبارات المساعد المركزي (المرحلة 3) — تعمل عبر node --test.
// تُشغّل tests/appAssistant.runner.ts (عبر tsx) وتتحقّق من الفئات المطلوبة:
//   Navigation • Spatial • Body Control • Conversation • Safety.
// كما تتحقّق من عدم اختراع معرّفات تشريحية أو إحداثيات (كل id موجود فعلاً في الكتالوج).
// ============================================================================
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const RUNNER = path.join('tests', 'appAssistant.runner.ts');

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
const byName = (n) => data.results.find((r) => r.name === n);
const actionTypes = (n) => (byName(n)?.actions || []).map((a) => a.type);
const actionTargets = (n) => (byName(n)?.actions || []).map((a) => a.targetId);

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------
test('Navigation: opens the requested screens and tabs', () => {
  assert.ok(actionTypes('nav.organs.1').includes('open_tab'), 'organs tab');
  assert.strictEqual(byName('nav.organs.1').actions.find((a) => a.type === 'open_tab').targetId, 'tab:organs');
  assert.strictEqual(byName('nav.history').actions[0].targetId, 'screen:history');
  assert.strictEqual(byName('nav.muscles').actions.find((a) => a.type === 'open_tab').targetId, 'tab:muscles');
  assert.strictEqual(byName('nav.library').actions.find((a) => a.type === 'open_tab').targetId, 'tab:medicalLibrary');
  assert.strictEqual(byName('nav.home').actions[0].targetId, 'screen:welcome');
  assert.strictEqual(byName('nav.health').actions[0].targetId, 'screen:healthInfo');
  // كل سيناريوهات التنقّل مفهومة ولا تحتاج تأكيدًا
  for (const n of ['nav.organs.1', 'nav.organs.2', 'nav.history', 'nav.anatomy', 'nav.muscles', 'nav.library', 'nav.home', 'nav.health']) {
    assert.strictEqual(byName(n).understood, true, `${n} understood`);
    assert.strictEqual(byName(n).needsConfirmation, false, `${n} no confirm`);
  }
});

// ---------------------------------------------------------------------------
// Spatial
// ---------------------------------------------------------------------------
test('Spatial: resolves real neighbours from context coordinates', () => {
  for (const n of ['spatial.above', 'spatial.below', 'spatial.between', 'spatial.near']) {
    const r = byName(n);
    assert.strictEqual(r.understood, true, `${n} understood`);
    assert.ok(r.actions.some((a) => a.type === 'highlight'), `${n} highlights a target`);
    assert.ok(r.resolved.length >= 1, `${n} resolves a real entry`);
  }
  // فوق القلب → الصدر، تحت القلب → البطن (من الإحداثيات الحقيقية)
  assert.strictEqual(byName('spatial.above').actions[0].targetId, 'region:chest:front');
  assert.strictEqual(byName('spatial.below').actions[0].targetId, 'region:abs:front');
});

// ---------------------------------------------------------------------------
// Body Control
// ---------------------------------------------------------------------------
test('Body Control: sets, moves and corrects the pain marker', () => {
  const c = byName('body.complaint');
  assert.strictEqual(c.understood, true);
  const setMarker = c.actions.find((a) => a.type === 'set_marker');
  assert.ok(setMarker, 'a marker is set');
  assert.ok(setMarker.targetId.startsWith('region:'), 'marker target is a real region');
  assert.match(String(setMarker.value), /^\d+(\.\d+)?,\d+(\.\d+)?,(front|back)$/, 'marker value = x,y,view');

  // تحريك العلامة من السياق (تحت شوية / ناحية اليمين)
  for (const n of ['body.move.down', 'body.move.right']) {
    const r = byName(n);
    const mv = r.actions.find((a) => a.type === 'move_marker');
    assert.ok(mv, `${n} moves the marker`);
    assert.match(String(mv.value), /^\d+(\.\d+)?,\d+(\.\d+)?,(front|back)$/, `${n} coords`);
  }
  // لا توجد علامة سابقة → لا تحريك (بل يطلب الموقع)
  assert.strictEqual(byName('body.move.noBase').actions.length, 0);
  assert.strictEqual(byName('body.move.noBase').understood, true);
});

// ---------------------------------------------------------------------------
// Conversation
// ---------------------------------------------------------------------------
test('Conversation: history, doctor summary, medications, acupressure', () => {
  assert.deepStrictEqual(actionTypes('conv.lastEntry'), ['navigate', 'open_last_entry']);
  assert.strictEqual(byName('conv.lastEntry').actions[0].targetId, 'screen:history');
  assert.deepStrictEqual(actionTypes('conv.doctorSummary'), ['navigate', 'doctor_summary']);
  // الأدوية: فتح + بحث فقط (لا وصف علاج)
  const med = actionTypes('conv.medications');
  assert.ok(med.includes('open_tab'));
  assert.strictEqual(byName('conv.medications').actions.find((a) => a.type === 'open_tab').targetId, 'tab:drugLookup');
  assert.ok(!med.includes('save'), 'medications must not prescribe/save');
  // نقاط الضغط تُفتح
  assert.strictEqual(byName('conv.acupressure').actions.find((a) => a.type === 'open_tab').targetId, 'tab:acupressure');
  // وصف الشاشة
  assert.strictEqual(byName('conv.describe').understood, true);
});

// ---------------------------------------------------------------------------
// Voice (state machine)
// ---------------------------------------------------------------------------
test('Voice: continuous Listening → Thinking → Speaking → Listening cycle', () => {
  const v = data.voice;
  assert.ok(v, 'voice block present');
  assert.deepStrictEqual(v.states, ['idle', 'listening', 'thinking', 'speaking']);
  assert.strictEqual(v.idle_to_listening, true);
  assert.strictEqual(v.listening_to_thinking, true);
  assert.strictEqual(v.thinking_to_speaking, true);
  assert.strictEqual(v.speaking_to_listening, true);
  assert.strictEqual(v.afterUserSpeech, 'thinking');
  assert.strictEqual(v.afterSpeechEndInCall, 'listening', 'returns to listening inside a call');
  assert.strictEqual(v.afterSpeechEndIdle, 'idle', 'returns to idle outside a call');
  assert.strictEqual(v.onListenStart, 'listening');
});

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------
test('Safety: sensitive actions require confirmation; no invented ids', () => {
  for (const n of ['safe.clearHistory', 'safe.savePain', 'safe.saveSeverity']) {
    const r = byName(n);
    assert.strictEqual(r.needsConfirmation, true, `${n} requires confirmation`);
    assert.ok(r.pending.length >= 1, `${n} has a pending action`);
    assert.ok(!r.actions.some((a) => a.type === 'save'), `${n} must not save without confirmation`);
  }
  // طلب غير معروف → غير مفهوم بلا إجراءات
  assert.strictEqual(byName('safe.unknown').understood, false);
  assert.strictEqual(byName('safe.unknown').actions.length, 0);
  // لا معرّفات تشريحية مُختلقة
  assert.ok(data.resolvedIdCheck.length > 0, 'resolved ids checked');
  assert.ok(data.resolvedIdCheck.every((c) => c.exists === true), 'every resolved id exists in the catalog');
  assert.ok(data.targetIdCheck.length > 0, 'target ids checked');
  assert.ok(data.targetIdCheck.every((c) => c.exists === true), 'every anatomy targetId exists in the catalog');
});
