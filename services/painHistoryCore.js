'use strict';

/** الحد الأقصى لعدد السجلات المحفوظة محليًا. */
const HISTORY_LIMIT = 1000;

function validRecords(records) {
  return Array.isArray(records)
    ? records.filter((entry) => entry && typeof entry === 'object' && typeof entry.id === 'string' && entry.id.length > 0)
    : [];
}

function sortByRecent(records) {
  return validRecords(records).sort((a, b) => {
    const aTime = a.createdAtIso ? Date.parse(a.createdAtIso) : Number.NEGATIVE_INFINITY;
    const bTime = b.createdAtIso ? Date.parse(b.createdAtIso) : Number.NEGATIVE_INFINITY;
    if (bTime !== aTime) return bTime - aTime;
    return String(b.id).localeCompare(String(a.id));
  });
}

function capHistory(records, limit) {
  const max = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : HISTORY_LIMIT;
  return validRecords(records).slice(0, max);
}

function prependRecord(records, record, limit) {
  if (!record || typeof record !== 'object' || typeof record.id !== 'string' || !record.id) return capHistory(records, limit);
  return capHistory([record, ...validRecords(records)], limit);
}

function mergeHistories(current, incoming, limit) {
  const byId = new Map();
  validRecords(current).forEach((entry) => byId.set(entry.id, entry));
  validRecords(incoming).forEach((entry) => byId.set(entry.id, entry));
  return capHistory(sortByRecent([...byId.values()]), limit);
}

function summarizeHistory(records, now) {
  const list = validRecords(records);
  const current = typeof now === 'number' && Number.isFinite(now) ? now : Date.now();
  const weekAgo = current - 7 * 24 * 60 * 60 * 1000;
  const recent = list.filter((item) => {
    if (!item.createdAtIso) return false;
    const timestamp = Date.parse(item.createdAtIso);
    return Number.isFinite(timestamp) && timestamp >= weekAgo && timestamp <= current;
  });
  const average = list.length
    ? list.reduce((sum, item) => sum + item.intensity, 0) / list.length
    : 0;
  const counts = Object.create(null);
  recent.forEach((item) => {
    const label = item.areaLabel || item.partId;
    if (label) counts[label] = (counts[label] || 0) + 1;
  });

  let topArea = null;
  let topAreaCount = 0;
  Object.keys(counts).forEach((key) => {
    if (counts[key] > topAreaCount) {
      topArea = key;
      topAreaCount = counts[key];
    }
  });

  return {
    count: list.length,
    average,
    urgentCount: list.filter((item) => item.urgent === true).length,
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
