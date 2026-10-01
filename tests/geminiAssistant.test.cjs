// tests/geminiAssistant.test.cjs
// ============================================================================
// اختبارات طبقة الذكاء الاصطناعي الحقيقية (Gemini) — تعمل عبر node --test.
// تُشغّل tests/geminiAssistant.runner.ts (عبر tsx) وتتحقّق من:
//   • فهم العامية المصرية + تحويل قرار Gemini إلى إجراءات موجودة فعلاً.
//   • سياسة العلامة الواحدة (set_marker مرة واحدة، move_marker على نفس العلامة،
//     "نفس المكان" لا تُنشئ ولا تحرّك).
//   • دمج السياق الطبي (المدة/المكان) دون إعادة السؤال.
//   • الصورة كمدخل متعدّد الوسائط → إجراء منظّم.
//   • بقاء طبقة الأمان المحلية عند وجود علامة خطر.
//   • السقوط إلى محرّك القواعد عند غياب Gemini.
//   • عدم اختراع إجراءات أو معرّفات تشريحية.
// ============================================================================
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const RUNNER = path.join('tests', 'geminiAssistant.runner.ts');

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
const markerActions = (n) =>
  (byName(n)?.actions || []).filter((a) => a.type === 'set_marker' || a.type === 'move_marker');

// ---------------------------------------------------------------------------
// 1) "عندي وجع في بطني" → فهم الشكوى + تحديد المنطقة بلا إجبار على النقر
// ---------------------------------------------------------------------------
test('Gemini: pain complaint is understood and a real region marker is set (no forced map tap)', () => {
  const r = byName('gemini.belly');
  assert.strictEqual(r.understood, true, 'complaint understood');
  assert.strictEqual(r.mode, 'medical', 'classified as medical');
  const set = r.actions.find((a) => a.type === 'set_marker');
  assert.ok(set, 'a marker is set from words alone (no map tap needed)');
  assert.strictEqual(set.targetId, 'region:abs:front', 'marker resolves to a real region');
  assert.match(String(set.value), /^\d+(\.\d+)?,\d+(\.\d+)?,(front|back)$/, 'marker value = x,y,view');
  // لا يوجد أكثر من علامة واحدة
  assert.strictEqual(markerActions('gemini.belly').length, 1, 'exactly one marker action');
});

// ---------------------------------------------------------------------------
// 2) "على الشمال" → تحريك نفس العلامة (لا علامة جديدة)
// ---------------------------------------------------------------------------
test('Gemini: "على الشمال" moves the SAME marker left, never creates a new one', () => {
  const r = byName('gemini.left');
  assert.strictEqual(r.understood, true);
  assert.strictEqual(actionTypes('gemini.left').includes('set_marker'), false, 'no new marker');
  const mv = r.actions.find((a) => a.type === 'move_marker');
  assert.ok(mv, 'moves the existing marker');
  assert.strictEqual(mv.targetId, 'pain_marker', 'moves the current pain marker');
  const [x, y, view] = String(mv.value).split(',');
  assert.ok(Number(x) < 50, `x moved left (got ${x})`);
  assert.strictEqual(Number(y), 50, 'y unchanged');
  assert.strictEqual(view, 'front', 'same view');
});

// ---------------------------------------------------------------------------
// 3) "فوق شوية" → تحريك نفس العلامة نسبيًا
// ---------------------------------------------------------------------------
test('Gemini: "فوق شوية" moves the same marker relative to its current position', () => {
  const r = byName('gemini.up');
  assert.strictEqual(r.understood, true);
  assert.strictEqual(actionTypes('gemini.up').includes('set_marker'), false, 'no new marker');
  const mv = r.actions.find((a) => a.type === 'move_marker');
  assert.ok(mv, 'moves the existing marker');
  const [x, y] = String(mv.value).split(',');
  assert.strictEqual(Number(x), 50, 'x unchanged');
  assert.ok(Number(y) < 50, `y moved up (got ${y})`);
});

// ---------------------------------------------------------------------------
// 4) "ورا شوية" → استخدام سياق الظهر
// ---------------------------------------------------------------------------
test('Gemini: "ورا شوية" switches to the back view context on the same marker', () => {
  const r = byName('gemini.back');
  assert.strictEqual(r.understood, true);
  const mv = r.actions.find((a) => a.type === 'move_marker');
  assert.ok(mv, 'moves the existing marker');
  const view = String(mv.value).split(',')[2];
  assert.strictEqual(view, 'back', 'uses the back (dorsal) context');
});

// ---------------------------------------------------------------------------
// 5) "نفس المكان" → لا set_marker ولا move_marker
// ---------------------------------------------------------------------------
test('Gemini: "نفس المكان" creates no marker and moves none (single-marker policy)', () => {
  const r = byName('gemini.same');
  assert.strictEqual(r.understood, true, 'still understood');
  assert.strictEqual(actionTypes('gemini.same').includes('set_marker'), false, 'no set_marker');
  assert.strictEqual(actionTypes('gemini.same').includes('move_marker'), false, 'no move_marker');
  assert.strictEqual(markerActions('gemini.same').length, 0, 'zero marker actions');
});

// ---------------------------------------------------------------------------
// 6) "عندي وجع في بطني من يومين" → رسالة واحدة + سياق صحيح
// ---------------------------------------------------------------------------
test('Gemini: "بطني من يومين" yields a single reply and keeps the correct pain context', () => {
  const r = byName('gemini.belly.duration');
  assert.strictEqual(r.understood, true);
  assert.ok(r.painContext, 'pain context present');
  assert.strictEqual(r.painContext.painLocation, 'البطن', 'location captured');
  assert.strictEqual(r.painContext.painDuration, 'من يومين', 'duration captured in one turn');
  // رسالة واحدة فقط (لا تكرار)
  assert.strictEqual(r.replyAr, 'فهمت، ألم في البطن بقاله يومين.', 'single, non-duplicated reply');
  assert.ok(r.actions.some((a) => a.type === 'set_marker'), 'marker set from the same message');
});

// ---------------------------------------------------------------------------
// 7) صورة + "هنا بيوجعني" → إجراء منظّم من الصورة + الكلام + السياق
// ---------------------------------------------------------------------------
test('Gemini: image + "هنا بيوجعني" produces a structured marker action', () => {
  const r = byName('gemini.image');
  assert.strictEqual(r.understood, true);
  assert.strictEqual(r.mode, 'medical');
  const set = r.actions.find((a) => a.type === 'set_marker');
  assert.ok(set, 'image+speech+context yields a set_marker action');
  assert.strictEqual(set.targetId, 'region:abs:front', 'resolves to a real anatomical region');
  assert.ok(r.painContext && r.painContext.painLocation === 'البطن', 'context updated from the image turn');
});

// ---------------------------------------------------------------------------
// 8) إجراءات تطبيق أخرى من Gemini → إجراءات موجودة فعلاً
// ---------------------------------------------------------------------------
test('Gemini: app-control decisions map to real existing actions', () => {
  const r = byName('gemini.navigate');
  assert.strictEqual(r.understood, true);
  assert.strictEqual(r.mode, 'app');
  assert.ok(r.actions.some((a) => a.type === 'open_tab' && a.targetId === 'tab:organs'), 'opens a real tab');
  assert.ok(r.actions.some((a) => a.type === 'navigate' && a.targetId === 'screen:body'), 'navigates to a real screen');
});

// ---------------------------------------------------------------------------
// 9) الأمان: العلامة الحمراء المحلية لا تعتمد على Gemini
// ---------------------------------------------------------------------------
test('Safety: local red-flag detection survives the Gemini reply (never hidden)', () => {
  const r = byName('gemini.safety');
  assert.deepStrictEqual(r.redFlags, ['rf:chest_breath'], 'local red flag detected');
  assert.strictEqual(data.safety.replyHasGemini, true, 'Gemini reply is included');
  assert.strictEqual(data.safety.replyLongerThanGemini, true, 'local safety text is preserved alongside');
});

// ---------------------------------------------------------------------------
// 10) السقوط: Gemini غير متاح → محرّك القواعد يردّ بنفس السلوك
// ---------------------------------------------------------------------------
test('Fallback: when Gemini is unavailable the rule-based engine answers identically', () => {
  assert.strictEqual(data.fallback.understood, true, 'rule engine understood');
  assert.ok(
    data.fallback.actions.some((a) => a.type === 'open_tab' && a.targetId === 'tab:organs'),
    'rule engine still opens the organs tab',
  );
  assert.strictEqual(data.fallback.matchesSync, true, 'async path === sync rule engine when AI is absent');
});

// ---------------------------------------------------------------------------
// 11) التطبيع: لا اختراع إجراءات
// ---------------------------------------------------------------------------
test('Normalisation: unknown action types are dropped; empty decisions are rejected', () => {
  assert.deepStrictEqual(data.normalize.keptTypes, ['set_marker'], 'only real actions survive');
  assert.strictEqual(data.normalize.emptyIsNull, true, 'empty decision → null');
  assert.strictEqual(data.normalize.onlyReplyNotNull, true, 'reply-only decision is valid');
  assert.strictEqual(data.normalize.onlyReplyActions, 0, 'reply-only decision has no actions');
});

// ---------------------------------------------------------------------------
// 12) دمج السياق الطبي
// ---------------------------------------------------------------------------
test('Context merge: new info wins and arrays are unioned', () => {
  assert.strictEqual(data.merge.painLocation, 'البطن', 'new location overrides old');
  assert.strictEqual(data.merge.painDuration, 'من يومين', 'new duration added');
  assert.deepStrictEqual(data.merge.painQuality, ['نابض', 'حارق'], 'qualities unioned');
});

// ---------------------------------------------------------------------------
// 13) لا إجراءات مُختلقة + لا معرّفات تشريحية مُختلقة
// ---------------------------------------------------------------------------
test('No invented actions or anatomical ids anywhere in the results', () => {
  assert.ok(data.actionTypeCheck.length > 0, 'action types were checked');
  assert.ok(data.actionTypeCheck.every((c) => c.exists === true), 'every action type exists in ACTION_SAFETY');
  assert.ok(data.targetIdCheck.length > 0, 'anatomical target ids were checked');
  assert.ok(data.targetIdCheck.every((c) => c.exists === true), 'every anatomical targetId exists in the catalog');
});
