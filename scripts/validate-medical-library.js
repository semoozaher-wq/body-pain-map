#!/usr/bin/env node
// scripts/validate-medical-library.js
// تحقّق صارم من المكتبة الطبية: يمنع خلط مرض بمنطقة أخرى، ويمنع الأكواد المُختَرعة،
// ويتأكد أن كل عرض مُشار إليه موجود فعلًا، وأن علامات الخطر والمصادر مكتملة بثلاث لغات.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

const anatomy = read('data/anatomyPainMap.json');
const symptomsDoc = read('data/medical/symptoms.json');
const diseases = read('data/medical/diseases.json');
const organDoc = read('data/medical/organConditions.json');
const regionalPath = 'data/medical/regionalConditions.json';
const regional = fs.existsSync(path.join(root, regionalPath)) ? read(regionalPath) : { conditions: [] };
const triagePath = 'data/medical/triageQuestions.json';
const triage = fs.existsSync(path.join(root, triagePath)) ? read(triagePath) : { regions: {} };

const ALLOWED_REGIONS = new Set(['back', 'head_neck', 'lower_limb', 'torso_front', 'upper_limb']);
const GROUP_SLUGS = new Set(Object.keys(anatomy.groups));
const LANGUAGES = ['ar', 'en', 'fr'];

const conditions = [...diseases.conditions, ...organDoc.conditions, ...regional.conditions];
const symptomIds = new Set(symptomsDoc.symptoms.map((s) => s.id));
const errors = [];
const warnings = [];
const seen = new Set();

for (const c of conditions) {
  const where = c.id || '(missing id)';
  if (!c.id) errors.push('condition without id');
  if (seen.has(c.id)) errors.push(`duplicate condition id: ${c.id}`);
  seen.add(c.id);

  // 1) كل نص ثلاثي اللغة مكتمل
  for (const field of ['name', 'summary', 'redFlags']) {
    for (const lang of LANGUAGES) {
      if (!c[field] || typeof c[field][lang] !== 'string' || !c[field][lang].trim()) {
        errors.push(`${where}: missing ${field}.${lang}`);
      }
    }
  }

  // 2) المناطق ضمن القائمة المسموحة، والمجموعات موجودة فعليًا في خريطة التشريح
  if (!Array.isArray(c.regions) || c.regions.length === 0) errors.push(`${where}: regions must be a non-empty array`);
  for (const r of c.regions || []) if (!ALLOWED_REGIONS.has(r)) errors.push(`${where}: unknown region "${r}"`);
  if (!Array.isArray(c.muscleGroups)) errors.push(`${where}: muscleGroups must be an array`);
  for (const g of c.muscleGroups || []) if (!GROUP_SLUGS.has(g)) errors.push(`${where}: unknown muscle group "${g}"`);
  // منع خلط: حالة عضلية بلا مجموعة ولا عضو = لا يمكن مطابقتها بمنطقة تشريحية
  if ((c.muscleGroups || []).length === 0 && !(c.organs && c.organs.length)) {
    errors.push(`${where}: must map to at least one muscle group or one organ`);
  }

  // 3) منع الأكواد المُختَرعة: إمّا كود قياسي، أو مُعلَّم صراحةً أنه غير مربوط
  const isStandard = typeof c.doid === 'string' && /^DOID:\d+$/.test(c.doid);
  if (!isStandard && c.doidStatus !== 'not-mapped') {
    errors.push(`${where}: doid is neither a valid DOID code nor explicitly flagged doidStatus="not-mapped"`);
  }
  if (typeof c.icd10 !== 'string' || !/^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/.test(c.icd10)) {
    errors.push(`${where}: missing or malformed icd10 code ("${c.icd10}")`);
  }

  // 4) كل عرض مُشار إليه موجود فعلًا
  if (!Array.isArray(c.symptoms) || c.symptoms.length === 0) errors.push(`${where}: symptoms must be a non-empty array`);
  for (const s of c.symptoms || []) if (!symptomIds.has(s)) errors.push(`${where}: references unknown symptom "${s}"`);

  // 5) المصادر
  if (!Array.isArray(c.sources) || c.sources.length === 0) errors.push(`${where}: missing sources`);
  for (const src of c.sources || []) if (!/^https:\/\//.test(src.url || '')) errors.push(`${where}: invalid source url "${src.url}"`);
  if (!/^https:\/\//.test(c.medlinePlusUrl || '')) errors.push(`${where}: missing valid medlinePlusUrl`);
}

// 6) الأعراض: كل عرض إمّا كود HPO معياري معرَّف باسمه، أو مصطلح محلي معلَّم
const symptomSeen = new Set();
for (const s of symptomsDoc.symptoms) {
  if (symptomSeen.has(s.id)) errors.push(`duplicate symptom id: ${s.id}`);
  symptomSeen.add(s.id);
  for (const lang of LANGUAGES) {
    if (!s.name?.[lang] || !s.description?.[lang]) errors.push(`${s.id}: missing localized name/description (${lang})`);
  }
  if (!Array.isArray(s.regions) || s.regions.length === 0) errors.push(`${s.id}: regions must be a non-empty array`);
  for (const r of s.regions || []) if (!ALLOWED_REGIONS.has(r)) errors.push(`${s.id}: unknown region "${r}"`);
  const standard = typeof s.hpo === 'string' && /^HP:\d{7}$/.test(s.hpo);
  if (standard) {
    if (s.ontologyStatus && s.ontologyStatus !== 'standard') errors.push(`${s.id}: has HPO code but ontologyStatus is not "standard"`);
  } else if (s.ontologyStatus !== 'local') {
    errors.push(`${s.id}: no valid HPO code and not flagged ontologyStatus="local" (invented codes are forbidden)`);
  }
}

// 7) أسئلة الفرز: مربوطة بمناطق صحيحة، وكل سؤال إنذاري له نص تنبيه بثلاث لغات
const triageRegions = Object.keys(triage.regions || {});
if (triageRegions.length === 0) errors.push('triageQuestions.json has no regions');
for (const region of triageRegions) {
  if (!ALLOWED_REGIONS.has(region)) errors.push(`triage: unknown region "${region}"`);
  const qs = triage.regions[region];
  if (!Array.isArray(qs) || qs.length < 3) errors.push(`triage: region "${region}" needs at least 3 questions`);
  for (const q of qs || []) {
    for (const lang of LANGUAGES) if (!q.text?.[lang]) errors.push(`triage ${q.id}: missing text.${lang}`);
    if (q.redFlag) for (const lang of LANGUAGES) if (!q.alert?.[lang]) errors.push(`triage ${q.id}: redFlag question missing alert.${lang}`);
  }
}

// 8) إحصاء التغطية لكل منطقة (المناطق التي لا تملك أي حالة = تحذير)
const regionCoverage = {};
for (const r of ALLOWED_REGIONS) regionCoverage[r] = conditions.filter((c) => c.regions.includes(r)).length;
for (const [r, n] of Object.entries(regionCoverage)) if (n === 0) warnings.push(`region "${r}" has no condition mapped`);

if (errors.length) {
  console.error('Medical library validation FAILED:');
  errors.forEach((e) => console.error('  ERROR: ' + e));
  warnings.forEach((w) => console.warn('  WARN: ' + w));
  process.exit(1);
}
console.log('Medical library validation passed.');
console.log(`  conditions: ${conditions.length} (base ${diseases.conditions.length}, organ ${organDoc.conditions.length}, regional ${regional.conditions.length})`);
console.log(`  symptoms: ${symptomsDoc.symptoms.length} (HPO ${symptomsDoc.symptoms.filter((s) => s.ontologyStatus === 'standard' || /^HP:/.test(s.hpo || '')).length}, local ${symptomsDoc.symptoms.filter((s) => s.ontologyStatus === 'local').length})`);
console.log(`  triage regions: ${triageRegions.join(', ')} | red-flag questions: ${triageRegions.reduce((n, r) => n + triage.regions[r].filter((q) => q.redFlag).length, 0)}`);
console.log('  region coverage: ' + Object.entries(regionCoverage).map(([r, n]) => `${r}=${n}`).join(', '));
warnings.forEach((w) => console.warn('  WARN: ' + w));
