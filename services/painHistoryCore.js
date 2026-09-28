'use strict';

/**
 * painHistoryCore.js — منطق نقيّ (pure) لسجلّ الألم المحلي.
 *
 * السبب: كان منطق الدمج/الترتيب/الحد الأقصى مبعثرًا داخل `MainApp.tsx`
 * (`importHistory`, `saveResults` …). استخراجه هنا يجعل كل ميزة جديدة
 * (دفتر الألم، التذكيرات، التقارير…) تستخدم نفس القواعد بلا ازدواج،
 * ويجعله قابلًا للاختبار في Node دون React Native.
 *
 * لا وصول لشبكة ولا تخزين هنا — هذه دوال نقيّة فقط.
 */

/** الحد الأقصى لعدد السجلات المحفوظة محليًا. */
const HISTORY_LIMIT = 1000;

/**
 * ترتيب السجلات من الأحدث إلى الأقدم بحسب `createdAtIso`
 * (والسجلات بلا تاريخ تبقى في مواضعها النسبية).
 * @param {Array<{ createdAtIso?: string }>} records
 * @returns {Array}
 */
function sortByRecent(records) {
  return [...records].sort((a, b) => String(b && b.createdAtIso ? b.createdAtIso : '').localeCompare(String(a && a.createdAtIso ? a.createdAtIso : '')));
}

/**
 * قصّ السجل لأقصى عدد مسموح.
 * @param {Array} records
 * @param {number} [limit]
 * @returns {Array}
 */
function capHistory(records, limit) {
  const max = Number.isFinite(limit) && limit > 0 ? limit : HISTORY_LIMIT;
  return records.slice(0, max);
}

/**
 * إضافة سجل في المقدمة (سلوك «أحدث فحص أولًا») مع الالتزام بالحد الأقصى.
 * @param {Array} records
 * @param {object} record
 * @param {number} [limit]
 * @returns {Array}
 */
function prependRecord(records, record, limit) {
  return capHistory([record, ...(Array.isArray(records) ? records : [])], limit);
}

/**
 * دمج سجلّين بلا تكرار بحسب `id` (السجل الوارد يستبدل القديم بنفس الـid)،
 * ثم الترتيب من الأحدث للأقدم، ثم القصّ للحد الأقصى. نفس سلوك الاستيراد
 * السابق تمامًا لضمان عدم كسر أي بيانات موجودة.
 * @param {Array<{ id?: string }>} current
 * @param {Array<{ id?: string }>} incoming
 * @param {number} [limit]
 * @returns {Array}
 */
function mergeHistories(current, incoming, limit) {
  const byId = new Map();
  (Array.isArray(current) ? current : []).forEach((entry) => byId.set(entry && entry.id, entry));
  (Array.isArray(incoming) ? incoming : []).forEach((entry) => byId.set(entry && entry.id, entry));
  return capHistory(sortByRecent([...byId.values()]), limit);
}

/**
 * ملخّص وصفي بسيط للسجل (لا تشخيص): العدد، متوسط الشدة، عدد التنبيهات،
 * والمنطقة الأكثر تكرارًا في آخر ٧ أيام.
 * @param {Array<{ intensity?: number, urgent?: boolean, createdAtIso?: string, partId?: string, areaLabel?: string }>} records
 * @param {number} [now] الطابع الزمني الحالي (لحقن الوقت في الاختبارات).
 * @returns {{ count: number, average: number, urgentCount: number, recentCount: number, topArea: string | null, topAreaCount: number }}
 */
function summarizeHistory(records, now) {
  const list = Array.isArray(records) ? records : [];
  const current = typeof now === 'number' ? now : Date.now();
  const weekAgo = current - 7 * 24 * 60 * 60 * 1000;
  const recent = list.filter((item) => !item || !item.createdAtIso || new Date(item.createdAtIso).getTime() >= weekAgo);
  const average = list.length ? list.reduce((sum, item) => sum + (Number(item && item.intensity) || 0), 0) / list.length : 0;
  const counts = {};
  recent.forEach((item) => {
    const label = (item && (item.areaLabel || item.partId)) || '';
    if (!label) return;
    counts[label] = (counts[label] || 0) + 1;
  });
  let topArea = null;
  let topAreaCount = 0;
  Object.keys(counts).forEach((key) => {
    if (counts[key] > topAreaCount) { topArea = key; topAreaCount = counts[key]; }
  });
  return {
    count: list.length,
    average,
    urgentCount: list.filter((item) => item && item.urgent).length,
    recentCount: recent.length,
    topArea,
    topAreaCount,
  };
}

module.exports = {
  HISTORY_LIMIT,
  sortByRecent,
  capHistory,
  prependRecord,
  mergeHistories,
  summarizeHistory,
};
