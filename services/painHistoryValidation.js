'use strict';

/** Runtime validation for locally stored/imported health records.
 *  TypeScript types disappear at runtime, so persisted JSON must be checked here.
 */

const TRIAGE_STATUSES = new Set(['routine', 'high_reported_intensity', 'urgent']);
const MAX_STRING = 4000;
const MAX_LIST = 20;

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBoundedNumber(value, min, max) {
  return isFiniteNumber(value) && value >= min && value <= max;
}

function isShortString(value, max = MAX_STRING) {
  return typeof value === 'string' && value.length <= max;
}

function isStringList(value, maxItems = MAX_LIST, maxItemLength = 200) {
  return Array.isArray(value)
    && value.length <= maxItems
    && value.every((item) => typeof item === 'string' && item.length <= maxItemLength);
}

function isValidIsoDate(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isCheckup(value) {
  if (!value || typeof value !== 'object') return false;
  const item = value;

  if (!isShortString(item.id, 200) || !item.id.trim()) return false;
  if (!isShortString(item.partId, 300) || !item.partId.trim()) return false;
  if (!isBoundedNumber(item.intensity, 0, 10)) return false;
  if (!isShortString(item.painType, 200)) return false;
  if (!isShortString(item.duration, 200)) return false;
  if (!isShortString(item.createdAt, 200)) return false;
  if (item.createdAtIso !== undefined && !isValidIsoDate(item.createdAtIso)) return false;
  if (item.areaLabel !== undefined && !isShortString(item.areaLabel, 300)) return false;
  if (item.note !== undefined && !isShortString(item.note)) return false;
  if (item.medication !== undefined && !isShortString(item.medication, 1000)) return false;
  if (item.triggers !== undefined && !isShortString(item.triggers, 1000)) return false;
  if (item.sleepHours !== undefined && !isBoundedNumber(item.sleepHours, 0, 24)) return false;
  if (item.activity !== undefined && !isShortString(item.activity, 1000)) return false;
  if (item.urgent !== undefined && typeof item.urgent !== 'boolean') return false;
  if (item.triageStatus !== undefined && !TRIAGE_STATUSES.has(item.triageStatus)) return false;
  if (item.redFlags !== undefined && !isStringList(item.redFlags, MAX_LIST, 300)) return false;
  if (item.symptoms !== undefined && !isStringList(item.symptoms, MAX_LIST, 300)) return false;
  if (item.afterIntensity !== undefined && !isBoundedNumber(item.afterIntensity, 0, 10)) return false;
  if (item.selfCareGuide !== undefined && !isShortString(item.selfCareGuide, 300)) return false;
  if (item.selfCarePointId !== undefined && !isShortString(item.selfCarePointId, 300)) return false;

  return true;
}

/**
 * @param {unknown} value
 * @param {number} [maxItems=1000]
 * @returns {Array}
 */
function validateCheckupList(value, maxItems = 1000) {
  if (!Array.isArray(value) || value.length > maxItems) return [];
  return value.filter(isCheckup);
}

module.exports = {
  isCheckup,
  validateCheckupList,
  isValidIsoDate,
};
