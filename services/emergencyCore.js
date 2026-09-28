'use strict';

/**
 * emergencyCore.js — منطق نقيّ لأرقام الطوارئ وجهات الاتصال الطبية.
 *
 * ⚠️⚠️ ملاحظة تأكيد مطلوبة (NEEDS CONFIRMATION) ⚠️⚠️
 * -----------------------------------------------------------------
 * كل الأرقام في `data/emergencyNumbers.json` هي قيم افتراضية (DEFAULTS)
 * موضوعة لتشغيل الميزة، وليست موثّقة رسميًّا. أرقام الطوارئ تختلف بين
 * الدول وحتى بين المناطق داخل البلد نفسه، وقد تتغيّر.
 * لذلك:
 *   - كل بلد يحمل راية `needsConfirmation: true`.
 *   - الواجهة (EmergencyPanel) تُظهر إخلاء مسؤولية يطلب من المستخدم تأكيد
 *     الرقم قبل الاتصال.
 *   - يجب على مالك التطبيق مراجعة الجدول وتأكيده (أو إدخال رقم بلده يدويًّا)
 *     قبل الإطلاق. هذا القرار متعمَّد ومتروك للمالك.
 * -----------------------------------------------------------------
 *
 * لا وصول لشبكة هنا — دوال نقيّة قابلة للاختبار في Node.
 */

const raw = require('../data/emergencyNumbers.json');

/** قائمة الدول كما هي في ملف البيانات. */
const COUNTRIES = Array.isArray(raw.countries) ? raw.countries : [];

/** البلد الافتراضي عند غياب اختيار. */
const DEFAULT_COUNTRY_CODE = (raw._meta && raw._meta.defaultCountry) || 'EG';

/** مفتاح التخزين المحلي لاختيار البلد. */
const COUNTRY_STORAGE_KEY = 'bodymap-emergency-country-v1';

/** مفتاح التخزين المحلي لجهات الاتصال الطبية. */
const CONTACTS_STORAGE_KEY = 'bodymap-medical-contacts-v1';

/**
 * إيجاد بلد بالرمز (case-insensitive)، مع السقوط للبلد الافتراضي.
 * @param {string} [code]
 * @returns {object}
 */
function getCountry(code) {
  const target = String(code || '').toUpperCase();
  return COUNTRIES.find((entry) => entry.code === target)
    || COUNTRIES.find((entry) => entry.code === DEFAULT_COUNTRY_CODE)
    || COUNTRIES[0]
    || null;
}

/**
 * تنقية رقم هاتف للاستخدام في رابط tel: — نُبقي الأرقام و + و * و #.
 * @param {string} value
 * @returns {string}
 */
function sanitizePhone(value) {
  return String(value || '').replace(/[^0-9+*#]/g, '');
}

/**
 * هل الرقم صالح للاتصال؟ (٤ خانات على الأقل بعد التنقية).
 * @param {string} value
 * @returns {boolean}
 */
function isValidPhone(value) {
  const clean = sanitizePhone(value);
  const digits = clean.replace(/[^0-9]/g, '');
  // الحدّ الأدنى رقمين لأن أرقام الطوارئ القصيرة (مثل 15 في فرنسا / 14 في الجزائر)
  // أرقام حقيقية ومسجّلة في data/emergencyNumbers.json.
  return digits.length >= 2 && clean.length <= 20;
}

/**
 * بناء رابط الاتصال tel: من رقم خام.
 * @param {string} value
 * @returns {string}
 */
function buildTelUrl(value) {
  const clean = sanitizePhone(value);
  return clean ? `tel:${clean}` : '';
}

/**
 * تسمية مفتاح الرقم (ambulance/police/…) بثلاث لغات.
 * @param {string} key
 * @returns {{ ar: string, en: string, fr: string }}
 */
function numberKeyLabel(key) {
  const map = {
    general: { ar: 'الطوارئ', en: 'Emergency', fr: "Urgences" },
    ambulance: { ar: 'الإسعاف', en: 'Ambulance', fr: 'Ambulance' },
    police: { ar: 'الشرطة', en: 'Police', fr: 'Police' },
    fire: { ar: 'المطافئ', en: 'Fire', fr: 'Pompiers' },
    alternative: { ar: 'رقم بديل', en: 'Alternative', fr: 'Alternative' },
  };
  return map[key] || { ar: key, en: key, fr: key };
}

/**
 * جهات الاتصال الافتراضية لبلد ما (مع التسميات الثلاثية جاهزة للعرض).
 * @param {string} [code]
 * @returns {Array<{ key: string, label: { ar: string, en: string, fr: string }, number: string, telUrl: string }>}
 */
function getEmergencyNumbers(code) {
  const country = getCountry(code);
  if (!country || !Array.isArray(country.numbers)) return [];
  return country.numbers.map((entry) => ({
    key: entry.key,
    label: numberKeyLabel(entry.key),
    number: String(entry.number),
    telUrl: buildTelUrl(entry.number),
  }));
}

/** اسم البلد بثلاث لغات. */
function getCountryName(code, language) {
  const country = getCountry(code);
  if (!country) return '';
  const name = country.name || {};
  return name[language] || name.ar || name.en || country.code;
}

/** هل يحتاج هذا البلد تأكيدًا لأرقامه؟ (افتراضيًا نعم). */
function needsConfirmation(code) {
  const country = getCountry(code);
  return country ? country.needsConfirmation !== false : true;
}

/**
 * تطبيع جهة اتصال طبية واحدة: تنظيف الحقول والتحقق.
 * @param {object} contact
 * @returns {{ ok: boolean, contact?: object, error?: string }}
 */
function sanitizeContact(contact) {
  const name = String((contact && contact.name) || '').trim().slice(0, 60);
  const phoneRaw = String((contact && contact.phone) || '').trim();
  const relation = String((contact && contact.relation) || '').trim().slice(0, 40);
  if (!name) return { ok: false, error: 'name_required' };
  if (!isValidPhone(phoneRaw)) return { ok: false, error: 'phone_invalid' };
  return {
    ok: true,
    contact: {
      id: String((contact && contact.id) || ''),
      name,
      phone: sanitizePhone(phoneRaw),
      relation,
      isPrimary: Boolean(contact && contact.isPrimary),
    },
  };
}

/**
 * ترشيح قائمة جهات اتصال (تُستخدم عند قراءة التخزين المحلي).
 * @param {unknown} list
 * @returns {object[]}
 */
function sanitizeContactList(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  list.forEach((item) => {
    const result = sanitizeContact(item);
    if (result.ok && result.contact && result.contact.id) out.push(result.contact);
  });
  return out.slice(0, 50);
}

module.exports = {
  COUNTRIES,
  DEFAULT_COUNTRY_CODE,
  COUNTRY_STORAGE_KEY,
  CONTACTS_STORAGE_KEY,
  getCountry,
  getCountryName,
  needsConfirmation,
  getEmergencyNumbers,
  numberKeyLabel,
  sanitizePhone,
  isValidPhone,
  buildTelUrl,
  sanitizeContact,
  sanitizeContactList,
};
