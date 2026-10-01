// tests/knowledgeRetrieval.verify.test.cjs
// ============================================================================
// اختبارات التحقّق الموسّع لطبقة المعرفة الطبية + الاسترجاع (Medical Knowledge Retrieval).
// تعمل عبر node --test، وتُشغّل tests/knowledgeRetrieval.verify.runner.ts (عبر tsx).
//
// تُثبت فعليًا (باسترجاع حقيقي من بيانات المشروع، بلا شبكة):
//   (1) كل فئة مطلوبة تُرجِع نتائج صحيحة عبر الاسترجاع:
//       muscles / bones / joints / tendons / ligaments / nerves / vessels /
//       organs / regions + red flags.
//   (2) دعم العربية والإنجليزية والفرنسية في الاسترجاع (الاسم مُعرّب/مُترجم للغة المطلوبة).
//   (3) سلامة المصادر: لا مصدر عام (registry root مثل https://medlineplus.gov/)
//       يُعامَل كدليل على معلومة بلا مصدر مباشر، وكل عنصر مُسترجَع يحمل مصدرًا مباشرًا.
// ============================================================================
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const RUNNER = path.join('tests', 'knowledgeRetrieval.verify.runner.ts');

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
// (1) التغطية الفعلية لكل فئة عبر الاسترجاع
// ---------------------------------------------------------------------------
test('(1) Retrieval returns correct results for every required category', () => {
  const REQUIRED = ['muscles', 'bones', 'joints', 'tendons', 'ligaments', 'nerves', 'vessels', 'organs', 'regions'];
  assert.strictEqual(data.categories.length, REQUIRED.length, 'all category probes ran');
  for (const key of REQUIRED) {
    const c = data.categories.find((x) => x.key === key);
    assert.ok(c, `category probe present: ${key}`);
    assert.strictEqual(c.status, 'ok', `"${key}" (${c.query}) should return knowledge, got ${c.status}`);
    assert.strictEqual(c.found, true, `"${key}" should return an item of category ${JSON.stringify(c.expect)} (got ${c.matchedCategory})`);
    assert.ok(c.matchedName && c.matchedName.length > 0, `"${key}" matched item has a name`);
  }
});

test('(1) Retrieval surfaces Red Flags for red-flag queries', () => {
  assert.ok(data.redFlags.length >= 3, 'several red-flag probes ran');
  for (const r of data.redFlags) {
    assert.strictEqual(r.status, 'ok', `"${r.query}" should return knowledge`);
    assert.strictEqual(r.found, true, `"${r.query}" should surface at least one item carrying red flags`);
    assert.ok(r.redFlagCount > 0, `"${r.query}" redFlagCount > 0`);
    assert.ok(r.sampleRedFlag && r.sampleRedFlag.length > 0, `"${r.query}" sample red-flag text present`);
  }
});

// ---------------------------------------------------------------------------
// (2) دعم اللغات ar / en / fr
// ---------------------------------------------------------------------------
test('(2) Retrieval supports Arabic, English and French (localized to the requested language)', () => {
  assert.ok(data.multilingual.length >= 6, 'several language probes ran');
  for (const m of data.multilingual) {
    assert.strictEqual(m.status, 'ok', `[${m.lang}] "${m.query}" should return knowledge`);
    assert.strictEqual(m.resultLanguage, m.lang, `[${m.lang}] result.language must equal the requested language`);
    assert.strictEqual(
      m.localizedToRequestedLanguage,
      true,
      `[${m.lang}] "${m.query}" top name "${m.topName}" must be localized to ${m.lang}`,
    );
  }
  // يجب أن تكون اللغات الثلاث مُغطّاة فعليًا
  const langs = new Set(data.multilingual.map((m) => m.lang));
  for (const l of ['ar', 'en', 'fr']) assert.ok(langs.has(l), `language ${l} exercised`);
});

// ---------------------------------------------------------------------------
// (3) سلامة المصادر: لا مصدر عام كدليل على معلومة بلا مصدر مباشر
// ---------------------------------------------------------------------------
test('(3) No generic (registry-root) source is used as evidence for a fact lacking a direct source', () => {
  const s = data.sources;
  assert.ok(s.itemsChecked > 0, 'source probes returned items');
  // لا حالة مرضية تحمل رابطًا جذريًا عامًا (هذا كان الخلل: fallback إلى medlineplus.gov الجذري)
  assert.strictEqual(s.conditionAnyGenericSourceUrl, false, `no condition carries a generic source URL: ${JSON.stringify(s.conditionGenericUsages)}`);
  // الحالات بلا مصدر مباشر تُستبعد ولا تُقدَّم كمعرفة موثوقة
  assert.strictEqual(s.noSourceConditionExcluded, true, `no-source conditions leaked: ${JSON.stringify(s.leakedNoSourceConditions)}`);
});

test('(3) Every retrieved item carries at least one direct source', () => {
  const s = data.sources;
  assert.strictEqual(s.allItemsHaveSources, true, `items without a source: ${JSON.stringify(s.noSourceItems)}`);
});

// ---------------------------------------------------------------------------
// التغطية العامة للطبقة (أعداد العناصر المتاحة)
// ---------------------------------------------------------------------------
test('Knowledge Layer coverage is non-empty for every required bucket', () => {
  const c = data.coverage;
  for (const key of ['bones_joints', 'muscles', 'tendons_ligaments', 'nerves', 'organs', 'blood_vessels', 'pain_regions', 'red_flags']) {
    assert.ok(c[key] > 0, `coverage.${key} > 0 (got ${c[key]})`);
  }
});

// ---------------------------------------------------------------------------
// العقد: القيمة الحسّاسة ثابتة بالضبط
// ---------------------------------------------------------------------------
test('Sentinel value is exactly "no_reliable_knowledge"', () => {
  assert.strictEqual(data.constants.NO_RELIABLE_KNOWLEDGE, SENTINEL);
});
