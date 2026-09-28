'use strict';

/**
 * services/triage.js — واجهة رقيقة (thin wrapper) فوق المصدر الوحيد للحقيقة.
 *
 * قبل التوحيد كان هذا الملف يحتوي منطق الفرز مستقلًّا عن `triageEngine.js`.
 * الآن كل منطق قرار الفرز موجود في `services/triageCore.js` فقط، وهذا الملف
 * يُعيد تصديره حتى تبقى كل الاستيرادات الحالية تعمل دون تغيير:
 *   import { getTriageStatus } from './services/triage.js';
 */

const { getTriageStatus, isTriageStatus, TRIAGE_STATUSES, HIGH_INTENSITY_THRESHOLD } = require('./triageCore.js');

module.exports = {
  getTriageStatus,
  isTriageStatus,
  TRIAGE_STATUSES,
  HIGH_INTENSITY_THRESHOLD,
};
