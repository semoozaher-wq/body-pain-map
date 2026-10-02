'use strict';

// اختبارات منطق الإعدادات النقي (services/settings/core.js) الذي يُشغّله
// hook الإعدادات hooks/useSettings.ts. البلوبرنت #14.

const test = require('node:test');
const assert = require('node:assert/strict');

const s = require('../services/settings/core.js');

test('mergeSettings يُعيد القيم الافتراضية عند مدخل فارغ', () => {
  assert.deepEqual(s.mergeSettings(undefined), { ...s.DEFAULT_SETTINGS });
  assert.deepEqual(s.mergeSettings(null), { ...s.DEFAULT_SETTINGS });
  assert.deepEqual(s.mergeSettings('x'), { ...s.DEFAULT_SETTINGS });
});

test('mergeSettings يحافظ على القيم الصالحة المحفوظة', () => {
  const out = s.mergeSettings({ voiceEnabled: false, voiceRate: 1.2, autoSpeakReplies: true, medicalAlerts: false });
  assert.equal(out.voiceEnabled, false);
  assert.equal(out.voiceRate, 1.2);
  assert.equal(out.autoSpeakReplies, true);
  assert.equal(out.medicalAlerts, false);
});

test('mergeSettings يملأ المفاتيح الناقصة من الافتراضيات (ترقية الإعدادات)', () => {
  const out = s.mergeSettings({ voiceEnabled: false });
  assert.equal(out.voiceEnabled, false);
  assert.equal(out.voiceRate, s.DEFAULT_SETTINGS.voiceRate);
  assert.equal(out.autoSpeakReplies, s.DEFAULT_SETTINGS.autoSpeakReplies);
  assert.equal(out.medicalAlerts, s.DEFAULT_SETTINGS.medicalAlerts);
});

test('mergeSettings يتجاهل الأنواع الخاطئة ويستخدم الافتراضي', () => {
  const out = s.mergeSettings({ voiceEnabled: 'yes', medicalAlerts: 1 });
  assert.equal(out.voiceEnabled, s.DEFAULT_SETTINGS.voiceEnabled);
  assert.equal(out.medicalAlerts, s.DEFAULT_SETTINGS.medicalAlerts);
});

test('clampVoiceRate يقيّد السرعة ضمن الحدود', () => {
  assert.equal(s.clampVoiceRate(0.1), s.VOICE_RATE_MIN);
  assert.equal(s.clampVoiceRate(5), s.VOICE_RATE_MAX);
  assert.equal(s.clampVoiceRate(1.0), 1.0);
  assert.equal(s.clampVoiceRate('1.25'), 1.25);
});

test('clampVoiceRate يُعيد الافتراضي للقيم غير الرقمية', () => {
  assert.equal(s.clampVoiceRate('abc'), s.DEFAULT_SETTINGS.voiceRate);
  assert.equal(s.clampVoiceRate(NaN), s.DEFAULT_SETTINGS.voiceRate);
  assert.equal(s.clampVoiceRate(Infinity), s.DEFAULT_SETTINGS.voiceRate);
});

test('clampVoiceRate يقرّب لخانتين عشريتين', () => {
  assert.equal(s.clampVoiceRate(1.23456), 1.23);
});

test('DEFAULT_SETTINGS مجمّد ولا يمكن تعديله', () => {
  assert.equal(Object.isFrozen(s.DEFAULT_SETTINGS), true);
});
