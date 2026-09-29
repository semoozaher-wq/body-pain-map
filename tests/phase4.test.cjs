// tests/phase4.test.cjs
// ============================================================================
// اختبارات المرحلة 4 — المساعد المركزي (Central AI Assistant).
// تعمل عبر node --test، وتُشغّل tests/phase4.runner.ts (عبر tsx) وتتحقّق من:
//   • المحادثة العامة (تحيّة/حال/مشاعر/تغيير موضوع/شكر/هوية) — بلا الردّ الافتراضي الفاشل.
//   • الطبقات الثلاث (عام/طبي/تحكّم) مع تصنيف الوضع الصحيح.
//   • الفهم المكاني داخل الجملة (تحت صدري بشوية / جنب القلب ناحية الشمال) بإحداثيات حقيقية.
//   • الجمل الجديدة غير المُضافة مسبقًا للمعجم.
//   • الأمان: الجمل الغامضة تبقى غير مفهومة وبلا إجراءات، وكل id موجود فعلاً في الكتالوج.
// ============================================================================
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const RUNNER = path.join('tests', 'phase4.runner.ts');

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
const actionFor = (n, type) => (byName(n)?.actions || []).find((a) => a.type === type);

const FORBIDDEN_DEFAULT = 'معليش، مفهمتش الطلب';

// ---------------------------------------------------------------------------
// 1) المحادثة العامة: لا ردّ افتراضي فاشل + تصنيف صحيح
// ---------------------------------------------------------------------------
test('General chat: greetings/smalltalk/emotion/thanks/identity are understood as general', () => {
  for (const n of ['gen.greeting', 'gen.howareyou', 'gen.emotion', 'gen.thanks', 'gen.identity']) {
    const r = byName(n);
    assert.ok(r, `${n} exists`);
    assert.strictEqual(r.understood, true, `${n} understood`);
    assert.strictEqual(r.mode, 'general', `${n} mode=general`);
    assert.strictEqual(r.actions.length, 0, `${n} produces no app actions`);
    assert.ok(!r.replyAr.includes(FORBIDDEN_DEFAULT), `${n} does not use the forbidden default reply`);
    assert.ok(r.replyAr.trim().length > 0, `${n} has a natural reply`);
  }
});

// ---------------------------------------------------------------------------
// 2) تغيير الموضوع: يعمل في أي وقت + يفرّغ السياق
// ---------------------------------------------------------------------------
test('Topic change: understood as general and resets the conversation context', () => {
  for (const n of ['gen.topicChange', 'new.topicChange']) {
    const r = byName(n);
    assert.strictEqual(r.understood, true, `${n} understood`);
    assert.strictEqual(r.mode, 'general', `${n} mode=general`);
    assert.ok(actionTypes(n).includes('reset_context'), `${n} emits reset_context`);
    assert.ok(!r.replyAr.includes(FORBIDDEN_DEFAULT), `${n} natural reply`);
  }
});

// ---------------------------------------------------------------------------
// 3) الطبقة الطبية: شكوى الألم تُصنَّف «طبي» وتضع علامة على عنصر حقيقي
// ---------------------------------------------------------------------------
test('Medical layer: pain complaint is classified medical and marks a real region', () => {
  const r = byName('med.pain');
  assert.strictEqual(r.understood, true, 'med.pain understood');
  assert.strictEqual(r.mode, 'medical', 'med.pain mode=medical');
  const marker = actionFor('med.pain', 'set_marker');
  assert.ok(marker, 'med.pain sets a marker');
  assert.strictEqual(marker.targetId, 'region:upper:back', 'marker targets the real upper-back region');
  assert.ok(r.resolved.includes('region:upper:back'), 'resolved contains the real entry');
});

test('Medical follow-ups (above / severity / correction) stay medical and understood', () => {
  for (const n of ['med.followup.above', 'med.severity', 'med.correction']) {
    const r = byName(n);
    assert.strictEqual(r.understood, true, `${n} understood`);
    assert.strictEqual(r.mode, 'medical', `${n} mode=medical`);
  }
});

// ---------------------------------------------------------------------------
// 4) الفهم المكاني داخل الجملة (إحداثيات حقيقية + إزاحة حقيقية)
// ---------------------------------------------------------------------------
test('Spatial in-sentence: «تحت صدري بشوية» resolves the chest and offsets the marker below it', () => {
  const r = byName('spatial.inSentence.below');
  assert.strictEqual(r.understood, true, 'understood');
  assert.strictEqual(r.mode, 'medical', 'mode=medical');
  const marker = actionFor('spatial.inSentence.below', 'set_marker');
  assert.ok(marker, 'sets a marker');
  assert.strictEqual(marker.targetId, 'region:chest:front', 'targets the real chest region');
  assert.ok(/^\d+,\d+,\w+$/.test(String(marker.value)), `marker value is real coordinates: ${marker.value}`);
  assert.ok(actionTypes('spatial.inSentence.below').includes('highlight'), 'highlights the target');
  // لا تناقض: لا نسأل «مكان الألم فين؟» بعد أن وضعنا العلامة فعلاً.
  assert.ok(!r.replyAr.includes('محتاج أعرف مكان الألم الأول'), 'no contradictory "need location" question after marking');
});

test('Spatial in-sentence: «جنب القلب ناحية الشمال» resolves the heart and offsets left', () => {
  const r = byName('spatial.inSentence.left');
  assert.strictEqual(r.understood, true, 'understood');
  const marker = actionFor('spatial.inSentence.left', 'set_marker');
  assert.ok(marker, 'sets a marker');
  assert.strictEqual(marker.targetId, 'organ:heart', 'targets the real heart organ');
  assert.ok(r.resolved.includes('organ:heart'), 'resolved contains organ:heart');
  assert.ok(/^\d+,\d+,\w+$/.test(String(marker.value)), `marker value is real coordinates: ${marker.value}`);
});

// ---------------------------------------------------------------------------
// 5) طبقة التحكّم في التطبيق
// ---------------------------------------------------------------------------
test('App control layer: navigation and highlight are classified app', () => {
  for (const n of ['app.highlight', 'app.navigate']) {
    const r = byName(n);
    assert.strictEqual(r.understood, true, `${n} understood`);
    assert.strictEqual(r.mode, 'app', `${n} mode=app`);
    assert.ok(r.resolved.length >= 1, `${n} resolves a real entry`);
  }
  assert.strictEqual(actionFor('app.navigate', 'open_tab').targetId, 'tab:organs', 'opens organs tab');
});

// ---------------------------------------------------------------------------
// 6) جمل جديدة تمامًا (غير مُضافة مسبقًا للمعجم)
// ---------------------------------------------------------------------------
test('Brand-new sentences (not pre-added to any lexicon) are handled gracefully', () => {
  // تحيّة مختلفة الصياغة («صباح الفل يا نجم») — تُفهم كتحيّة عامة
  const g = byName('new.greeting');
  assert.strictEqual(g.understood, true, 'new greeting understood');
  assert.strictEqual(g.mode, 'general', 'new greeting mode=general');
  assert.ok(!g.replyAr.includes(FORBIDDEN_DEFAULT), 'new greeting natural reply');

  // مشاعر مختلفة («حاسس إني مخنوق النهاردة»)
  const e = byName('new.emotion');
  assert.strictEqual(e.understood, true, 'new emotion understood');
  assert.strictEqual(e.mode, 'general', 'new emotion mode=general');

  // تغيير موضوع بأسلوب مختلف («خلاص كفاية كده سيبك منه»)
  const t = byName('new.topicChange');
  assert.strictEqual(t.understood, true, 'new topic-change understood');
  assert.strictEqual(t.mode, 'general', 'new topic-change mode=general');
});

// ---------------------------------------------------------------------------
// 7) الأمان: الجمل الغامضة لا تُنفّذ شيئًا
// ---------------------------------------------------------------------------
test('Safety: ambiguous gibberish stays not-understood with zero actions', () => {
  const r = byName('ambiguous.gibberish');
  assert.strictEqual(r.understood, false, 'gibberish not understood');
  assert.strictEqual(r.actions.length, 0, 'gibberish executes no actions');
  assert.ok(!r.replyAr.includes(FORBIDDEN_DEFAULT), 'gibberish uses the clarifying question, not the forbidden default');
  for (const a of data.ambiguousSafe) {
    assert.strictEqual(a.understood, false, `${a.scenario} not understood`);
    assert.strictEqual(a.actions, 0, `${a.scenario} zero actions`);
  }
});

// ---------------------------------------------------------------------------
// 8) لا اختراع لمعرّفات: كل id مُحدَّد موجود فعلاً في الكتالوج
// ---------------------------------------------------------------------------
test('No hallucinated ids: every resolved/target id exists in the catalog', () => {
  for (const c of data.resolvedIdCheck) {
    assert.strictEqual(c.exists, true, `resolved id ${c.id} (${c.scenario}) exists in catalog`);
  }
  for (const c of data.targetIdCheck) {
    assert.strictEqual(c.exists, true, `target id ${c.id} (${c.scenario}) exists in catalog`);
  }
});
