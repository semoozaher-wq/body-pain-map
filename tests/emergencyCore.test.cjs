'use strict';

// اختبارات منطق الطوارئ وجهات الاتصال (services/emergencyCore.js)
// + التحقق من صلاحية شكل ملف الأرقام data/emergencyNumbers.json.
//
// الهدف: ضمان أن كل رقم طوارئ مُعلّم بأنه يحتاج تأكيدًا (قيمة افتراضية)،
// وأن منطق بناء رابط tel: والتحقق من الأرقام يعمل كما هو متوقّع.

const test = require('node:test');
const assert = require('node:assert/strict');

const e = require('../services/emergencyCore.js');
const data = require('../data/emergencyNumbers.json');

test('شكل ملف أرقام الطوارئ سليم وكل بلد مُعلّم باحتياجه للتأكيد', () => {
  assert.ok(Array.isArray(data.countries) && data.countries.length > 0);
  data.countries.forEach((country) => {
    assert.equal(typeof country.code, 'string', `${country.code} code`);
    assert.equal(typeof country.name.ar, 'string');
    assert.equal(typeof country.name.en, 'string');
    assert.equal(typeof country.name.fr, 'string');
    assert.equal(country.needsConfirmation, true, `${country.code} should need confirmation`);
    assert.ok(Array.isArray(country.numbers) && country.numbers.length > 0, `${country.code} numbers`);
    country.numbers.forEach((entry) => {
      assert.equal(typeof entry.key, 'string');
      assert.equal(typeof entry.number, 'string');
      assert.ok(e.isValidPhone(entry.number), `${country.code}/${entry.key} = ${entry.number} should be valid`);
    });
  });
});

test('getCountry يرجّع البلد المطلوب ويسقط للافتراضي', () => {
  assert.equal(e.getCountry('eg').code, 'EG');
  assert.equal(e.getCountry('nope').code, e.DEFAULT_COUNTRY_CODE);
  assert.equal(e.getCountry().code, e.DEFAULT_COUNTRY_CODE);
});

test('needsConfirmation يتعامل مع البلد الافتراضي بحذر', () => {
  assert.equal(e.needsConfirmation('EG'), true);
  assert.equal(e.needsConfirmation('unknown-land'), true);
});

test('buildTelUrl ينقّي الرقم لبناء رابط اتصال آمن', () => {
  assert.equal(e.buildTelUrl('123'), 'tel:123');
  assert.equal(e.buildTelUrl(' 12 34 '), 'tel:1234');
  assert.equal(e.buildTelUrl('+20 100-000'), 'tel:+20100000');
  assert.equal(e.buildTelUrl('abc'), '');
});

test('sanitizeContact يتحقق من الحقول المطلوبة وينظّفها', () => {
  assert.equal(e.sanitizeContact({ name: '', phone: '123' }).ok, false);
  assert.equal(e.sanitizeContact({ name: 'Dr', phone: '' }).ok, false);
  const ok = e.sanitizeContact({ id: 'x', name: '  Dr A  ', phone: '010 0000' });
  assert.equal(ok.ok, true);
  assert.equal(ok.contact.name, 'Dr A');
  assert.equal(ok.contact.phone, '0100000');
});

test('sanitizeContactList يُسقط العناصر غير الصالحة ويحصر العدد', () => {
  const out = e.sanitizeContactList([
    { id: '1', name: 'A', phone: '12345' },
    { name: 'no id', phone: '999' },
    { id: '2', name: 'B', phone: 'bad' },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, '1');
});

test('getEmergencyNumbers يرجع تسميات ثلاثية وروابط tel', () => {
  const entries = e.getEmergencyNumbers('EG');
  assert.ok(entries.length > 0);
  entries.forEach((entry) => {
    assert.ok(entry.label.ar && entry.label.en && entry.label.fr);
    assert.ok(entry.telUrl.startsWith('tel:'));
  });
});
