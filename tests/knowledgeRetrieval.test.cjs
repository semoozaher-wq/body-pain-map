// tests/knowledgeRetrieval.test.cjs
// ============================================================================
// اختبارات طبقة المعرفة الطبية + الاسترجاع (Medical Knowledge Layer + Retrieval).
// تعمل عبر node --test، وتُشغّل tests/knowledgeRetrieval.runner.ts (عبر tsx).
//
// تُثبت المطلوب حرفيًا:
//   (أ) Retrieval يرجع المعرفة مع المصدر.
//   (ب) المعرفة غير الموجودة → no_reliable_knowledge.
//   (ج) Gemini يستخدم Retrieval فعليًا (تعليمات النظام المُرسَلة إلى generateObject
//       تحتوي المعرفة المسترجَعة + مصادرها، وتحتوي القيمة الحسّاسة عند غيابها).
// ============================================================================
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const RUNNER = path.join('tests', 'knowledgeRetrieval.runner.ts');

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
const SENTINEL = 'no_reliable_knowledge';

// ---------------------------------------------------------------------------
// (أ) Retrieval يرجع المعرفة مع المصدر
// ---------------------------------------------------------------------------
test('(a) Retrieval returns reliable knowledge WITH a source for real medical queries', () => {
  assert.ok(data.retrieval.length >= 3, 'several real queries were exercised');
  for (const r of data.retrieval) {
    assert.strictEqual(r.status, 'ok', `"${r.query}" should return knowledge`);
    assert.strictEqual(r.sentinel, null, `"${r.query}" should not carry the sentinel`);
    assert.ok(r.itemCount > 0, `"${r.query}" should return at least one item`);
    assert.ok(r.topName && r.topName.length > 0, `"${r.query}" top item has a name`);
    // كل عنصر مسترجَع يجب أن يحمل مصدرًا واحدًا على الأقل
    assert.strictEqual(r.allItemsHaveSources, true, `"${r.query}" every item carries a source`);
    // كل مصدر يجب أن يكون مكتملًا (عنوان + رابط http)
    assert.strictEqual(r.allSourcesWellFormed, true, `"${r.query}" every source is well-formed (title + http url)`);
    assert.ok(r.sourceCount > 0, `"${r.query}" has at least one source`);
    assert.ok(r.sampleSource && r.sampleSource.url.startsWith('http'), `"${r.query}" sample source has a real url`);
  }
});

// ---------------------------------------------------------------------------
// (ب) المعرفة غير الموجودة → no_reliable_knowledge
// ---------------------------------------------------------------------------
test('(b) Non-existent knowledge returns the no_reliable_knowledge sentinel', () => {
  assert.ok(data.sentinel.length >= 3, 'several no-knowledge queries were exercised');
  for (const r of data.sentinel) {
    assert.strictEqual(r.status, SENTINEL, `"${r.query}" should be no_reliable_knowledge`);
    assert.strictEqual(r.sentinel, SENTINEL, `"${r.query}" sentinel field must equal no_reliable_knowledge`);
    assert.strictEqual(r.itemCount, 0, `"${r.query}" must return zero items (no invention)`);
  }
});

// ---------------------------------------------------------------------------
// (ج) Gemini يستخدم Retrieval فعليًا — عبر نقطة الربط prepareGroundedRequest
// ---------------------------------------------------------------------------
test('(c) Gemini uses Retrieval: the system prompt sent to generateObject is grounded in retrieved knowledge', () => {
  // تعليمات النظام = تعليمات Gemini الأصلية + طبقة المعرفة (لا إعادة كتابة للأصل)
  assert.strictEqual(data.grounded.systemStartsWithBasePrompt, true, 'base Gemini prompt is preserved (no rewrite)');
  assert.strictEqual(data.grounded.systemLongerThanBase, true, 'grounding block is appended to the base prompt');
  assert.strictEqual(data.grounded.systemHasKnowledgeLayer, true, 'the KNOWLEDGE LAYER block is present');
  // المعرفة المسترجَعة فعليًا وصلت إلى الـPrompt (الاسم + المصدر)
  assert.strictEqual(data.grounded.status, 'ok', 'retrieval succeeded for the grounding query');
  assert.ok(data.grounded.itemCount > 0, 'retrieved items are injected');
  assert.ok(data.grounded.sourceCount > 0, 'retrieved sources are injected');
  assert.strictEqual(data.grounded.systemHasTopItemName, true, 'the retrieved fact (name) appears in the prompt');
  assert.strictEqual(data.grounded.systemHasSourceUrl, true, 'the retrieved source URL appears in the prompt');
});

test('(c) When no knowledge exists, Gemini receives the sentinel rule (no invented medicine)', () => {
  assert.strictEqual(data.sentinelGrounded.status, SENTINEL, 'grounding query with no knowledge → sentinel');
  assert.strictEqual(data.sentinelGrounded.itemCount, 0, 'no items injected when nothing is reliable');
  assert.strictEqual(data.sentinelGrounded.systemHasSentinel, true, 'the sentinel value is present in the system prompt');
  assert.strictEqual(data.sentinelGrounded.systemHasKnowledgeLayer, true, 'the KNOWLEDGE LAYER block is still present');
  assert.strictEqual(data.sentinelGrounded.systemStartsWithBasePrompt, true, 'base prompt preserved in the sentinel case too');
});

test('(c) The grounded prompt is a pure function of the retrieval result', () => {
  assert.strictEqual(data.direct.status, 'ok', 'retrieval succeeded');
  assert.strictEqual(data.direct.contextHasSourceLabel, true, 'knowledge context labels each source (المصدر)');
  assert.strictEqual(data.direct.contextHasTopName, true, 'knowledge context contains the retrieved fact');
  assert.strictEqual(data.direct.promptHasContext, true, 'the grounded prompt embeds the knowledge context');
  assert.ok(data.direct.sentinelContext.includes(SENTINEL), 'the empty context carries the sentinel');
});

// ---------------------------------------------------------------------------
// التغطية: طبقة المعرفة تغطي كل التصنيفات المطلوبة
// ---------------------------------------------------------------------------
test('Knowledge Layer covers every required category (bones/joints, muscles, tendons/ligaments, nerves, organs, vessels, regions, red flags)', () => {
  const c = data.coverage;
  assert.ok(c.bones_joints > 0, 'bones & joints covered');
  assert.ok(c.muscles > 0, 'muscles covered');
  assert.ok(c.tendons_ligaments > 0, 'tendons & ligaments covered');
  assert.ok(c.nerves > 0, 'nerves covered');
  assert.ok(c.organs > 0, 'organs covered');
  assert.ok(c.blood_vessels > 0, 'blood vessels covered');
  assert.ok(c.pain_regions > 0, 'pain regions covered');
  assert.ok(c.red_flags > 0, 'red flags covered');
});

// ---------------------------------------------------------------------------
// العقد: القيمة الحسّاسة ثابتة بالضبط
// ---------------------------------------------------------------------------
test('Sentinel value is exactly "no_reliable_knowledge"', () => {
  assert.strictEqual(data.constants.NO_RELIABLE_KNOWLEDGE, 'no_reliable_knowledge');
});
