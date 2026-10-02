// tests/doctorSummary.test.cjs
// ============================================================================
// اختبارات "الملخص القصير للطبيب" — عبر node --test.
// تُشغّل tests/doctorSummary.runner.ts (عبر tsx) وتتحقّق من:
//   • الحالات التي لا تستدعي زيارة طبيب (self_care / routine) ⇒ doctorSummary === ''.
//   • الحالات التي تستدعي زيارة طبيب (soon / urgent / emergency أو أي red flag)
//     ⇒ ملخص قصير جدًا يحتوي الحقول الخمسة المطلوبة بالضبط:
//        مكان الألم، المدة، الشدة، الأعراض المصاحبة، ما يزيده أو يخففه،
//     وينتهي بجملة واضحة: "خذ هذا الملخص معك للطبيب."
//   • الملخص قصير (بلا تقرير طبي طويل): سطر العنوان + 5 حقول + سطر الختام = 7 أسطر.
// ============================================================================
const { test } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const RUNNER = path.join('tests', 'doctorSummary.runner.ts');

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

const CLOSING = 'خذ هذا الملخص معك للطبيب.';
const FIELDS = ['مكان الألم', 'المدة', 'الشدة', 'الأعراض المصاحبة', 'ما يزيده أو يخففه'];

// ---------------------------------------------------------------------------
// 1) لا ملخص عندما لا تستدعي الحالة زيارة طبيب
// ---------------------------------------------------------------------------
const noSummaryCases = ['self_care_mild_neck', 'self_care_mild_knee', 'routine_long_duration'];
for (const name of noSummaryCases) {
  test(`no summary: ${name} (self_care / routine)`, () => {
    const r = byName(name);
    assert.ok(r, `case ${name} exists`);
    assert.ok(['self_care', 'routine'].includes(r.triage), `triage is self_care/routine, got ${r.triage}`);
    assert.strictEqual(r.gotSummary, false, 'doctorSummary must be empty');
    assert.strictEqual(r.summary, '', 'summary text must be empty');
  });
}

// ---------------------------------------------------------------------------
// 2) ملخص قصير عندما تستدعي الحالة زيارة طبيب
// ---------------------------------------------------------------------------
const summaryCases = [
  'soon_severity_8',
  'urgent_severity_9',
  'emergency_chest_pressure',
  'urgent_leg_swelling',
  'soon_with_factors',
];
for (const name of summaryCases) {
  test(`short summary: ${name}`, () => {
    const r = byName(name);
    assert.ok(r, `case ${name} exists`);
    assert.ok(
      ['soon', 'urgent', 'emergency'].includes(r.triage) || r.redFlagCount > 0,
      `triage warrants a doctor visit, got ${r.triage} / redFlags ${r.redFlagCount}`,
    );
    assert.strictEqual(r.gotSummary, true, 'doctorSummary must be present');
    assert.ok(r.hasFiveFields, `summary contains all five fields: ${r.summary}`);
    for (const field of FIELDS) {
      assert.ok(r.summary.includes(field), `summary contains "${field}"`);
    }
    assert.ok(r.summary.includes(CLOSING), `summary ends with the closing line: ${r.summary}`);
    assert.ok(r.isShort, `summary is short (<= 7 lines), got ${r.lineCount}`);
  });
}

// ---------------------------------------------------------------------------
// 3) لا تكرار للأسئلة ولا تقرير طبي طويل داخل الملخص
// ---------------------------------------------------------------------------
test('summary contains no follow-up questions and is not a long report', () => {
  for (const name of summaryCases) {
    const r = byName(name);
    assert.ok(!r.summary.includes('؟'), `no question marks in summary: ${name}`);
    assert.ok(!r.summary.includes('?'), `no question marks in summary: ${name}`);
    assert.ok(r.lineCount <= 7, `at most 7 lines (header + 5 fields + closing): ${name}`);
  }
});
