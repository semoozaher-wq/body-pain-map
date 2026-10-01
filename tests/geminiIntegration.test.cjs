// tests/geminiIntegration.test.cjs
// ============================================================================
// اختبار تكامل حقيقي (Integration) مع Gemini API الفعلي.
// يُشغّل tests/geminiIntegration.runner.ts (عبر tsx)، والذي يستدعي نقطة النهاية
// الخادمية الحقيقية api/assistant.ts (handler) بالمسار الكامل:
//
//   User question → Retrieval → Grounded Prompt → Gemini → Structured Response
//
// • بلا GEMINI_API_KEY: تُتخطّى اختبارات Gemini الحيّة بوضوح (skip) دون فشل،
//   ويُثبِت الاختبار أن المنظومة موصولة بنقطة النهاية الحقيقية وأن التخطّي نظيف.
// • مع GEMINI_API_KEY: تُنفَّذ الاختبارات الحيّة وتُثبِت أن Gemini استخدم المعلومات
//   المسترجَعة ومصادرها، وأن مسار no_reliable_knowledge يعمل.
// ============================================================================
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const RUNNER = path.join('tests', 'geminiIntegration.runner.ts');

function runRunner() {
  const res = spawnSync('npx', ['tsx', RUNNER], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
    timeout: 120000,
  });
  assert.strictEqual(res.status, 0, `runner exited with ${res.status}: ${res.stderr}`);
  const out = (res.stdout || '').trim();
  assert.ok(out.length > 0, 'runner produced no output');
  return JSON.parse(out);
}

const data = runRunner();
const SENTINEL = 'no_reliable_knowledge';

// ---------------------------------------------------------------------------
// المنظومة موصولة بنقطة النهاية الحقيقية وتتخطّى نظيفًا بلا مفتاح
// ---------------------------------------------------------------------------
test('Integration harness targets the real Gemini endpoint and skips cleanly without a key', () => {
  if (data.skipped) {
    assert.strictEqual(data.reason, 'no_api_key', 'skip reason is no_api_key');
    assert.strictEqual(data.configured, false, 'not configured without a key');
  } else {
    assert.strictEqual(data.configured, true, 'configured when a key is present');
    assert.ok(data.grounded, 'grounded result present when configured');
    assert.ok(data.noKnowledge, 'no-knowledge result present when configured');
  }
});

// ---------------------------------------------------------------------------
// (2)+(3) المسار الحقيقي: Retrieval → Grounded Prompt → Gemini → Structured Response
//         وإثبات أن Gemini استخدم المعلومات المسترجَعة ومصادرها
// ---------------------------------------------------------------------------
test('(2/3) Gemini returns a structured decision grounded in the retrieved knowledge and cites its sources', (t) => {
  if (data.skipped) {
    t.skip('GEMINI_API_KEY not set — live Gemini integration not executed in this environment');
    return;
  }
  const g = data.grounded;
  // الاسترجاع أعاد معرفة موثوقة
  assert.strictEqual(g.retrievalStatus, 'ok', 'retrieval returned reliable knowledge');
  assert.ok(g.retrievalItemCount > 0, 'retrieval returned at least one item');
  // الـPrompt المُقيَّد احتوى الاسم + رابط المصدر
  assert.strictEqual(g.systemHasKnowledgeLayer, true, 'KNOWLEDGE LAYER block present in the grounded prompt');
  assert.strictEqual(g.systemHasTopName, true, 'retrieved fact (name) injected into the prompt');
  assert.strictEqual(g.systemHasSourceUrl, true, 'retrieved source URL injected into the prompt');
  // الاستجابة المنظّمة صحيحة الشكل
  assert.strictEqual(g.endpointStatusCode, 200, 'endpoint returned 200');
  assert.strictEqual(g.decisionShape.isObject, true, 'Gemini returned a structured decision object');
  assert.strictEqual(g.decisionShape.intentValid, true, `decision.intent is a valid intent (got ${JSON.stringify(g.decision && g.decision.intent)})`);
  assert.strictEqual(g.decisionShape.replyIsString, true, 'decision.reply is a string');
  assert.ok(g.decisionShape.replyLength > 0, 'decision.reply is non-empty');
  // إثبات أن Gemini استخدم المعلومات المسترجَعة فعلًا (الاسم + المصدر)
  assert.strictEqual(g.replyMentionsRetrievedName, true, `reply cites the retrieved fact "${g.topName}"`);
  assert.ok(
    g.replyMentionsSourceDomain || g.replyMentionsAnySourceTitle,
    `reply cites a retrieved source (domains: ${JSON.stringify(g.sourceDomains)})`,
  );
});

// ---------------------------------------------------------------------------
// (4) مسار no_reliable_knowledge الحقيقي عبر Gemini
// ---------------------------------------------------------------------------
test('(4) A question with no library knowledge produces no_reliable_knowledge and Gemini does not invent medicine', (t) => {
  if (data.skipped) {
    t.skip('GEMINI_API_KEY not set — live Gemini integration not executed in this environment');
    return;
  }
  const n = data.noKnowledge;
  assert.strictEqual(n.noRetrievalStatus, SENTINEL, 'retrieval returns the no_reliable_knowledge sentinel');
  assert.strictEqual(n.noRetrievalItemCount, 0, 'no items retrieved for the unknown question');
  assert.strictEqual(n.systemHasSentinel, true, 'the sentinel rule is present in the grounded prompt');
  // الاستجابة تبقى منظّمة وصحيحة الشكل (لا انهيار)
  assert.strictEqual(n.endpointStatusCode, 200, 'endpoint returned 200');
  assert.strictEqual(n.decisionShape.isObject, true, 'Gemini returned a structured decision object');
  assert.strictEqual(n.decisionShape.intentValid, true, 'decision.intent is a valid intent');
  assert.strictEqual(n.decisionShape.replyIsString, true, 'decision.reply is a string');
  // Gemini يُصرّح بعدم توفّر معرفة موثوقة بدل اختراع معلومة طبية
  assert.strictEqual(n.replySignalsNoKnowledge, true, `reply signals lack of reliable knowledge: ${JSON.stringify(n.reply)}`);
});

// ---------------------------------------------------------------------------
// العقد: القيمة الحسّاسة ثابتة بالضبط
// ---------------------------------------------------------------------------
test('Sentinel value is exactly "no_reliable_knowledge"', () => {
  assert.strictEqual(data.constants.NO_RELIABLE_KNOWLEDGE, SENTINEL);
});
