#!/usr/bin/env node
// scripts/validate-medical-library.js
// تحقّق صارم من المكتبة الطبية + التصنيف التشريحي:
//  - يمنع خلط مرض بمنطقة أخرى (منطقة/مجموعة عضلية/بنية تشريحية غير موجودة = خطأ).
//  - يمنع الأكواد المُختَرعة (DOID/HPO) ويطلب وسمًا صريحًا لأي كود غير مُتحقَّق منه.
//  - يتأكد أن كل عرض مُشار إليه موجود فعلًا، وأن كل نص ثلاثي اللغة مكتمل.
//  - يتحقق من هرمية regionTaxonomy.json (منطقة → منطقة فرعية → بنية) ونطاقات الحجم.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'));

const anatomy = read('data/anatomyPainMap.json');
const symptomsDoc = read('data/medical/symptoms.json');
const diseases = read('data/medical/diseases.json');
const organDoc = read('data/medical/organConditions.json');
const regional = read('data/medical/regionalConditions.json');
const triage = read('data/medical/triageQuestions.json');
const taxonomy = read('data/medical/regionTaxonomy.json');

const ALLOWED_REGIONS = new Set(['back', 'head_neck', 'lower_limb', 'torso_front', 'upper_limb']);
const GROUP_SLUGS = new Set(Object.keys(anatomy.groups));
const LANGUAGES = ['ar', 'en', 'fr'];
const errors = [];
const warnings = [];

/* ---------- 1) التصنيف التشريحي ---------- */
const BAND_KEYS = new Set(Object.keys(taxonomy.sizeBands || {}));
const TYPE_KEYS = new Set(taxonomy.structureTypes || []);
const TAX_REGION = new Set();
const TAX_SUB = new Set();
const TAX_STRUCT = new Map();
for (const r of taxonomy.regions || []) {
  if (!r.id || TAX_REGION.has(r.id)) errors.push(`taxonomy: bad or duplicate region id "${r.id}"`);
  TAX_REGION.add(r.id);
  for (const lang of ['ar', 'en']) if (!r.label?.[lang]) errors.push(`taxonomy region ${r.id}: missing label.${lang}`);
  if (!Array.isArray(r.subRegions) || r.subRegions.length === 0) errors.push(`taxonomy region ${r.id}: no sub-regions`);
  for (const s of r.subRegions || []) {
    if (!s.id || TAX_SUB.has(s.id)) errors.push(`taxonomy: bad or duplicate sub-region id "${s.id}"`);
    TAX_SUB.add(s.id);
    if (s.regionId !== r.id) errors.push(`taxonomy sub-region ${s.id}: regionId mismatch (${s.regionId} != ${r.id})`);
    for (const lang of ['ar', 'en']) if (!s.label?.[lang]) errors.push(`taxonomy sub-region ${s.id}: missing label.${lang}`);
    if (!s.icdChapterHint) errors.push(`taxonomy sub-region ${s.id}: missing icdChapterHint`);
    if (!Array.isArray(s.structures) || s.structures.length === 0) errors.push(`taxonomy sub-region ${s.id}: no structures`);
    for (const st of s.structures || []) {
      if (!st.id || TAX_STRUCT.has(st.id)) errors.push(`taxonomy: bad or duplicate structure id "${st.id}"`);
      TAX_STRUCT.set(st.id, st);
      if (st.subRegionId !== s.id) errors.push(`taxonomy structure ${st.id}: subRegionId mismatch`);
      for (const lang of ['ar', 'en']) if (!st.label?.[lang]) errors.push(`taxonomy structure ${st.id}: missing label.${lang}`);
      if (!BAND_KEYS.has(st.sizeBand)) errors.push(`taxonomy structure ${st.id}: unknown sizeBand "${st.sizeBand}"`);
      if (!TYPE_KEYS.has(st.type)) errors.push(`taxonomy structure ${st.id}: unknown type "${st.type}"`);
    }
  }
}
if (!taxonomy.notice?.ar || !taxonomy.notice?.en) errors.push('taxonomy: missing bilingual scope notice');

/* ---------- 2) الحالات ---------- */
const conditions = [...diseases.conditions, ...organDoc.conditions, ...regional.conditions];
const symptomIds = new Set(symptomsDoc.symptoms.map((s) => s.id));
const seen = new Set();
const batches = {};
let withTaxonomy = 0;

for (const c of conditions) {
  const where = c.id || '(missing id)';
  if (!c.id) errors.push('condition without id');
  if (seen.has(c.id)) errors.push(`duplicate condition id: ${c.id}`);
  seen.add(c.id);
  if (c.batch) batches[c.batch] = (batches[c.batch] || 0) + 1;

  // نصوص ثلاثية اللغة
  for (const field of ['name', 'summary', 'redFlags']) {
    for (const lang of LANGUAGES) {
      if (!c[field] || typeof c[field][lang] !== 'string' || !c[field][lang].trim()) {
        errors.push(`${where}: missing ${field}.${lang}`);
      }
    }
  }

  // مناطق ومجموعات عضلية مطابقة فعلًا
  if (!Array.isArray(c.regions) || c.regions.length === 0) errors.push(`${where}: regions must be a non-empty array`);
  for (const r of c.regions || []) if (!ALLOWED_REGIONS.has(r)) errors.push(`${where}: unknown region "${r}"`);
  if (!Array.isArray(c.muscleGroups)) errors.push(`${where}: muscleGroups must be an array`);
  for (const g of c.muscleGroups || []) if (!GROUP_SLUGS.has(g)) errors.push(`${where}: unknown muscle group "${g}"`);
  if ((c.muscleGroups || []).length === 0 && !(c.organs && c.organs.length)) {
    errors.push(`${where}: must map to at least one muscle group or one organ`);
  }

  // ربط تشريحي دقيق (اختياري لكنه صارم إن وُجد)
  if (c.taxonomy) {
    withTaxonomy += 1;
    if (!TAX_SUB.has(c.taxonomy.subRegion)) errors.push(`${where}: unknown taxonomy.subRegion "${c.taxonomy.subRegion}"`);
    if (!Array.isArray(c.taxonomy.structures) || c.taxonomy.structures.length === 0) {
      errors.push(`${where}: taxonomy.structures must be a non-empty array`);
    }
    for (const st of c.taxonomy.structures || []) {
      if (!TAX_STRUCT.has(st)) errors.push(`${where}: unknown taxonomy structure "${st}"`);
    }
  } else if (['D', 'E', 'F'].includes(c.batch)) {
    errors.push(`${where}: batch ${c.batch} requires a taxonomy link`);
  }

  // منع الأكواد المُختَرعة
  const isStandard = typeof c.doid === 'string' && /^DOID:\d+$/.test(c.doid);
  if (!isStandard && c.doidStatus !== 'not-mapped') {
    errors.push(`${where}: doid neither valid DOID nor flagged doidStatus="not-mapped"`);
  }
  if (typeof c.icd10 !== 'string' || !/^[A-Z][0-9]{2}(\.[0-9A-Z]{1,4})?$/.test(c.icd10)) {
    errors.push(`${where}: missing or malformed icd10 code ("${c.icd10}")`);
  }
  if (c.icd10Note && typeof c.icd10Note !== 'string') errors.push(`${where}: icd10Note must be a string`);

  // أعراض موجودة + التشابه المميز (منع تكرار عام)
  if (!Array.isArray(c.symptoms) || c.symptoms.length === 0) errors.push(`${where}: symptoms must be a non-empty array`);
  for (const s of c.symptoms || []) if (!symptomIds.has(s)) errors.push(`${where}: references unknown symptom "${s}"`);

  // مصادر
  if (!Array.isArray(c.sources) || c.sources.length === 0) errors.push(`${where}: missing sources`);
  for (const src of c.sources || []) if (!/^https:\/\//.test(src.url || '')) errors.push(`${where}: invalid source url "${src.url}"`);
  if (!/^https:\/\//.test(c.medlinePlusUrl || '')) errors.push(`${where}: missing valid medlinePlusUrl`);
}

/* ---------- 3) الأعراض ---------- */
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

/* ---------- 4) أسئلة الفرز ---------- */
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

/* ---------- 5) التغطية ---------- */
const regionCoverage = {};
for (const r of ALLOWED_REGIONS) regionCoverage[r] = conditions.filter((c) => c.regions.includes(r)).length;
for (const [r, n] of Object.entries(regionCoverage)) if (n === 0) warnings.push(`region "${r}" has no condition mapped`);
const mappedStructures = [...TAX_STRUCT.keys()].filter((id) => conditions.some((c) => c.taxonomy?.structures?.includes(id)));

if (errors.length) {
  console.error('Medical library validation FAILED:');
  errors.forEach((e) => console.error('  ERROR: ' + e));
  process.exit(1);
}
const batchList = ['A', 'B', 'C', 'D', 'E', 'F'].filter((b) => batches[b]).map((b) => `${b}=${batches[b]}`).join(' ');
console.log('Medical library validation passed.');
console.log(`  conditions: ${conditions.length} (base ${diseases.conditions.length}, organ ${organDoc.conditions.length}, regional ${regional.conditions.length}) [${batchList}]`);
console.log(`  taxonomy: ${taxonomy.regions.length} regions, ${TAX_SUB.size} sub-regions, ${TAX_STRUCT.size} structures, mapped-to-conditions ${mappedStructures.length}, linked conditions ${withTaxonomy}`);
console.log(`  symptoms: ${symptomsDoc.symptoms.length} (HPO ${symptomsDoc.symptoms.filter((s) => /^HP:\d{7}$/.test(s.hpo || '')).length}, local ${symptomsDoc.symptoms.filter((s) => s.ontologyStatus === 'local').length})`);
console.log(`  triage: ${triageRegions.join(', ')} | ${Object.values(triage.regions).flat().length} questions | ${Object.values(triage.regions).flat().filter((q) => q.redFlag).length} red-flag`);
console.log('  region coverage: ' + Object.entries(regionCoverage).map(([r, n]) => `${r}=${n}`).join(', '));
warnings.forEach((w) => console.warn('  WARN: ' + w));
