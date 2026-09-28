'use strict';

/**
 * triageCore.js — المصدر الوحيد للحقيقة (single source of truth) لقرار فرز
 * شدة الألم في تطبيق BodyMap Pain.
 *
 * السبب: قبل هذا الملف كان هناك ازدواج بين `services/triage.js` و
 * `services/triageEngine.js`، وأيّ ميزة تُخرج درجة خطورة جديدة قد تعتمد على
 * أحد الملفين دون الآخر. هذا الملف يفصل *قرار الفرز البسيط* (روتيني /
 * شدة مرتفعة / عاجل) في مكان واحد، ويستدعيه الباقي:
 *   - services/triage.js            → واجهة رقيقة (CommonJS) للاستيراد من الويب/التطبيق.
 *   - services/medical/triageLabels.ts → نصوص ثلاثية اللغة موحّدة للحالات.
 *
 * ملاحظة طبية/أمنية: هذا الملف لا يشخّص ولا يقرّر "خطورة" طبية حقيقية؛
 * هو فقط يعكس *ما أبلغ عنه المستخدم*. اختيار أي علامة إنذار يرفع الحالة
 * إلى «عاجل» فورًا لأن الطوارئ لا تنتظر باقي الأسئلة.
 *
 * لا اعتماد خارجي هنا ليعمل في الويب وفي اختبارات Node على السواء.
 */

/** الحالات الممكنة لنتيجة الفرز، مرتّبة من الأخفّ إلى الأشدّ. */
const TRIAGE_STATUSES = ['routine', 'high_reported_intensity', 'urgent'];

/** حدّ الشدّة الذي يُظهر تنبيه «شدة مرتفعة» (وليس طوارئ تلقائيًا). */
const HIGH_INTENSITY_THRESHOLD = 8;

/**
 * حساب حالة الفرز من الشدّة المبلّغ عنها وعلامات الإنذار المختارة.
 * - وجود أي علامة إنذار ← «عاجل» (له الأولوية على الشدّة).
 * - الشدّة ≥ ٨ بدون علامات ← «شدة مرتفعة» (تنبيه، وليس طوارئ).
 * - غير ذلك ← «روتيني».
 * القيم غير الرقمية (NaN/undefined/نص غير رقمي) لا تُنتج طوارئ وهمية.
 *
 * @param {number} intensity شدّة الألم 0..10 كما أدخلها المستخدم.
 * @param {string[]} [redFlags] علامات الإنذار المختارة.
 * @returns {'routine' | 'high_reported_intensity' | 'urgent'}
 */
function getTriageStatus(intensity, redFlags) {
  if (Array.isArray(redFlags) && redFlags.some((flag) => typeof flag === 'string' && flag.trim().length > 0)) return 'urgent';
  const value = Number(intensity);
  if (Number.isFinite(value) && value >= HIGH_INTENSITY_THRESHOLD) return 'high_reported_intensity';
  return 'routine';
}

/**
 * التحقق من أن قيمة ما هي حالة فرز معروفة (لحماية البيانات المخزّنة محليًا
 * عند الاستيراد أو ترقية النسخة).
 * @param {unknown} value
 * @returns {boolean}
 */
function isTriageStatus(value) {
  return typeof value === 'string' && TRIAGE_STATUSES.indexOf(value) !== -1;
}

module.exports = {
  getTriageStatus,
  isTriageStatus,
  TRIAGE_STATUSES,
  HIGH_INTENSITY_THRESHOLD,
};
