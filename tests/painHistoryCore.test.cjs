'use strict';

// اختبارات منطق السجل النقيّ (services/painHistoryCore.js) الذي يُشغّل
// hook السجل الموحّد hooks/usePainHistory.ts.

const test = require('node:test');
const assert = require('node:assert/strict');

const h = require('../services/painHistoryCore.js');

const rec = (id, iso, intensity, extra) => Object.assign({ id, createdAtIso: iso, intensity: intensity === undefined ? 5 : intensity }, extra || {});

test('prependRecord يضع الأحدث أولًا', () => {
  const out = h.prependRecord([rec('a', '2026-01-01T00:00:00Z')], rec('b', '2026-02-01T00:00:00Z'));
  assert.deepEqual(out.map((r) => r.id), ['b', 'a']);
});

test('mergeHistories يدمج بلا تكرار حسب id ويحافظ على الترتيب من الأحدث', () => {
  const current = [rec('a', '2026-01-01T00:00:00Z', 3), rec('b', '2026-02-01T00:00:00Z', 5)];
  const incoming = [rec('b', '2026-02-01T00:00:00Z', 9), rec('c', '2026-03-01T00:00:00Z', 7)];
  const out = h.mergeHistories(current, incoming);
  assert.deepEqual(out.map((r) => r.id), ['c', 'b', 'a']);
  assert.equal(out.find((r) => r.id === 'b').intensity, 9);
});

test('capHistory يطبّق الحد الأقصى للسجل', () => {
  const many = Array.from({ length: 1100 }, (_, i) => rec(String(i), '2026-01-01T00:00:00Z'));
  assert.equal(h.capHistory(many).length, h.HISTORY_LIMIT);
  assert.equal(h.capHistory(many, 10).length, 10);
});

test('summarizeHistory يُعيد ملخّصًا وصفيًّا فقط (عدد/متوسط/تنبيهات/أكثر منطقة)', () => {
  const now = Date.parse('2026-06-10T00:00:00Z');
  const list = [
    rec('a', '2026-06-09T00:00:00Z', 4, { urgent: false, partId: 'neck' }),
    rec('b', '2026-06-08T00:00:00Z', 6, { urgent: true, partId: 'neck' }),
    rec('c', '2026-01-01T00:00:00Z', 2, { partId: 'back' }),
  ];
  const s = h.summarizeHistory(list, now);
  assert.equal(s.count, 3);
  assert.equal(s.urgentCount, 1);
  assert.equal(s.recentCount, 2);
  assert.equal(s.topArea, 'neck');
  assert.equal(s.topAreaCount, 2);
});
