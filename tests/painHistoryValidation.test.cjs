'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isCheckup, validateCheckupList } = require('../services/painHistoryValidation.js');

const valid = {
  id: 'x', partId: 'neck', intensity: 6, painType: 'continuous', duration: 'days',
  createdAt: '2026-06-10', createdAtIso: '2026-06-10T00:00:00Z',
  redFlags: [], symptoms: [], urgent: false, triageStatus: 'routine',
};

test('isCheckup يقبل سجلًا صالحًا', () => assert.equal(isCheckup(valid), true));
test('isCheckup يرفض الشدة خارج 0..10', () => assert.equal(isCheckup({ ...valid, intensity: 11 }), false));
test('isCheckup يرفض تاريخ ISO غير صالح', () => assert.equal(isCheckup({ ...valid, createdAtIso: 'not-a-date' }), false));
test('isCheckup يرفض triageStatus غير معروف', () => assert.equal(isCheckup({ ...valid, triageStatus: 'critical' }), false));
test('validateCheckupList لا يمرر عناصر تالفة', () => assert.deepEqual(validateCheckupList([valid, { id: 'bad' }]).map((x) => x.id), ['x']));
