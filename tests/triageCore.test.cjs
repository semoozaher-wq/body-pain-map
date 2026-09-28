'use strict';

// اختبارات المصدر الوحيد للحقيقة لقرار الفرز (services/triageCore.js)
// والتأكد من أن services/triage.js أصبح واجهة رقيقة فوقه (لا ازدواج).

const test = require('node:test');
const assert = require('node:assert/strict');

const core = require('../services/triageCore.js');
const legacy = require('../services/triage.js');

test('triageCore يحافظ على سلوك الفرز التاريخي دون تغيير', () => {
  assert.equal(core.getTriageStatus(10, []), 'high_reported_intensity');
  assert.equal(core.getTriageStatus(8, []), 'high_reported_intensity');
  assert.equal(core.getTriageStatus(7, []), 'routine');
  assert.equal(core.getTriageStatus(2, ['sudden chest pressure']), 'urgent');
  assert.equal(core.getTriageStatus(10, ['fainting']), 'urgent');
  assert.equal(core.getTriageStatus(0), 'routine');
  assert.equal(core.getTriageStatus(Number.NaN), 'routine');
});

test('services/triage.js مجرّد واجهة رقيقة فوق المصدر الوحيد للحقيقة', () => {
  assert.equal(legacy.getTriageStatus, core.getTriageStatus);
  assert.equal(legacy.isTriageStatus, core.isTriageStatus);
  assert.deepEqual(legacy.TRIAGE_STATUSES, core.TRIAGE_STATUSES);
});

test('isTriageStatus يتحقق من القيم المخزّنة محليًّا', () => {
  assert.equal(core.isTriageStatus('urgent'), true);
  assert.equal(core.isTriageStatus('routine'), true);
  assert.equal(core.isTriageStatus('made_up_status'), false);
  assert.equal(core.isTriageStatus(5), false);
  assert.equal(core.isTriageStatus(null), false);
});
