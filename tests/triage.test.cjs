const test = require('node:test');
const assert = require('node:assert/strict');
const { getTriageStatus } = require('../services/triage.js');

test('intensity is not an automatic emergency label', () => {
  assert.equal(getTriageStatus(10, []), 'high_reported_intensity');
  assert.equal(getTriageStatus(8, []), 'high_reported_intensity');
  assert.equal(getTriageStatus(7, []), 'routine');
});

test('a selected red flag takes priority over reported intensity', () => {
  assert.equal(getTriageStatus(2, ['sudden chest pressure']), 'urgent');
  assert.equal(getTriageStatus(10, ['fainting']), 'urgent');
});

test('routine boundary is inclusive at zero and non-finite values do not fabricate emergencies', () => {
  assert.equal(getTriageStatus(0), 'routine');
  assert.equal(getTriageStatus(Number.NaN), 'routine');
});
