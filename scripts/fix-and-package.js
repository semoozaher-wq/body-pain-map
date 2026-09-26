#!/usr/bin/env node
/* scripts/fix-and-package.js
   خطوة واحدة: إصلاح/ربط البيانات بالتصنيف التشريحي الهرمي + وسم حالة كل كود ICD-10
   ثم التحقق + توليد ملف التوثيق العربي + تحديث الواجهة + ضغط الملفات المتغيّرة فقط. */
const fs = require('fs');
const path = require('path');
const { execSync, spawnSync } = require('child_process');

const ROOT = '/home/user/body-pain-map';
const R = (p) => path.join(ROOT, p);
const read = (p) => JSON.parse(fs.readFileSync(R(p), 'utf8'));
const writeJson = (p, o) => fs.writeFileSync(R(p), JSON.stringify(o, null, 2) + '\n');

const argv = process.argv.slice(2);
const pick = (k, d) => { const a = argv.find((x) => x.startsWith('--' + k + '=')); return a ? a.split('=').slice(1).join('=') : d; };
const VERIFIED = new Set(pick('verified', 'M54.12,M43.6,M75.4,G57.1,M70.60,M16.9,M47.12,M50.10,M48.02,M53.1,S13.4,G44.2,B02.9,E04.9,M75.1,M75.2,M75.5,M75.0,M19.01,S42.0,S43.1,G54.0,M35.3,M76.6,M77.4,G57.6,M20.1,L60.0,G57.5,M10.9,E11.621,S92.3,M22.2,M23.2,M76.5,M65.4,M65.3,M67.4,K02.9,K04.7,M26.60,K05.1,H66.0,H60.3,J02.9,J03.0,J04.0,ZIP')
  .split(',').map((s) => s.trim()).filter(Boolean));

/* ─────────── 1) التصنيف التشريحي ─────────── */
const tax = read('data/medical/regionTaxonomy.json');
const subs = {}; const structIds = new Set(); const structById = new Map();
tax.regions.forEach((r) => r.subRegions.forEach((s) => {
  subs[s.id] = { regionId: r.id, structures: (s.structures || []).map((x) => x.id) };
  (s.structures || []).forEach((st) => { structIds.add(st.id); structById.set(st.id, st); });
}));

/* ─────────── 2) إصلاح المناطق الناقصة ─────────── */
const KEYREG = [
  ['head_neck', /cervical|neck|throat|thyroid|torticoll|whiplash|zoster|tension-headache|dental|tooth|teeth|pericoron|tmj|gingiv|otitis|pharyng|strep|laryng|sinus|migraine/i],
  ['upper_limb', /shoulder|rotator|acromio|clavicl|bicipital|brachial|polymyalgia|hand|wrist|finger|thumb|carpal|quervain|ganglion|dupuytr|scaphoid|raynaud|elbow|tennis|golfer|cubital/i],
  ['lower_limb', /foot|ankle|toe|heel|achill|plantar|metatars|morton|hallux|nail|gout|diabet|knee|patell|menisc|hip|thigh|glute|trochant|sciatic|femur|meralgia|it-band|shin|tibia|tarsal|calf|hamstring|quadricep|dom/i],
  ['torso_front', /abdom|inguinal|umbilical|mesenter|constipat|bowel|cholecyst|pancreat|testic|epididym|orchit|hydrocel|varicocel|prostat|ectopic|pyelonephr|chest|rib|epigastr|pelvic|flank|kidney|bladder|appendic|hernia|reflux|gastr|peptic|ulcer|ovarian|endometr|angina|gerd/i],
  ['back', /back|lumbar|spine|sacr|coccyx|disc|ankylos|scolio|lumbago|vertebr|cauda|spondyl|fibromyalgia|myalgia/i],
];
const FILES = ['data/medical/diseases.json', 'data/medical/organConditions.json', 'data/medical/regionalConditions.json'];
const deriveRegion = (c) => {
  if (c.taxonomy && subs[c.taxonomy.subRegion]) return subs[c.taxonomy.subRegion].regionId;
  const id = String(c.id || '');
  for (const [reg, re] of KEYREG) if (re.test(id)) return reg;
  return null;
};
let regionsFixed = 0;
for (const f of FILES) {
  const doc = read(f);
  (doc.conditions || []).forEach((c) => {
    if (!Array.isArray(c.regions) || c.regions.length === 0) {
      const der = deriveRegion(c);
      if (der) { c.regions = [der]; regionsFixed++; console.log('  regions<-' + der + ' : ' + c.id); }
      else console.log('  !! UNRESOLVED REGION: ' + c.id + ' (regions=' + JSON.stringify(c.regions) + ')');
    }
    if (!Array.isArray(c.muscleGroups)) c.muscleGroups = [];
  });
  writeJson(f, doc);
}
console.log('regionsFixed=' + regionsFixed);

/* ─────────── 3) ربط الحالات الأساسية/الأعضاء بالمنطقة الفرعية والبنية ─────────── */
const SUBMAP = {
  'doid:4536': 'lumbar_spine', 'doid:1167': 'cervical_spine', 'doid:3059': 'shoulder', 'doid:8398': 'knee',
  'doid:1490': 'paraspinal_soft_tissue', 'doid:3311': 'cranium_facial', 'doid:11476-th': 'neck_soft_tissue',
  'doid:8505': 'paraspinal_soft_tissue', 'doid:10629': 'ankle_foot', 'doid:4248': 'ankle_foot', 'doid:7148': 'elbow',
  'doid:6713': 'thigh', 'doid:11067': 'paraspinal_soft_tissue', 'doid:8398-oa': 'knee', 'doid:8483': 'wrist_hand',
  'doid:13241': 'wrist_hand', 'doid:10202': 'cervical_spine', 'doid:10202-ls': 'lumbar_spine', 'doid:9350': 'lower_leg',
  'doid:10763': 'thoracic_cavity', 'doid:12353': 'abdominal_cavity', 'doid:8505-doms': 'thigh', 'doid:0050896': 'knee',
  'doid:appendicitis': 'abdominal_cavity', 'doid:gastritis': 'abdominal_cavity', 'doid:peptic-ulcer': 'abdominal_cavity',
  'doid:ibs': 'abdominal_cavity', 'doid:diverticulitis': 'abdominal_cavity', 'doid:gastroenteritis': 'abdominal_cavity',
  'doid:gallstones': 'abdominal_cavity', 'doid:hepatitis': 'abdominal_cavity', 'doid:pancreatitis': 'abdominal_cavity',
  'doid:uti': 'pelvis', 'doid:kidney-stone': 'abdominal_cavity', 'doid:ovarian-cyst': 'pelvis', 'doid:endometriosis': 'pelvis',
  'doid:angina': 'thoracic_cavity', 'doid:gerd-organ': 'thoracic_cavity',
};
const TOK = {
  knee: /patell|menisc|tibia|femur|cartilage|cruciate|tendon/i, shoulder: /acromi|clavicl|humer|scapul|supraspin|deltoid|joint|tendon|bursa/i,
  wrist_hand: /carpal|median|tendon|metacarp|radius|ulna|joint|nerve|retinac/i, elbow: /ulna|radius|epicondyl|tendon|joint|nerve/i,
  ankle_foot: /achill|calcane|metatars|plantar|talus|tibia|fibula|toe|tendon|fascia|nerve|heel/i, thigh: /femur|quadricep|hamstring|femoral|muscle|adductor/i,
  hip: /femur|acetabul|labrum|trochant|glute|joint|nerve/i, lumbar_spine: /disc|l[0-9]|vertebr|facet|nerve|muscle|ligament|joint/i,
  cervical_spine: /c[0-9]|disc|vertebr|facet|nerve|muscle|joint|ligament/i, thoracic_spine: /disc|t[0-9]|vertebr|facet|nerve|joint/i,
  paraspinal_soft_tissue: /muscle|fascia|ligament|tendon/i, neck_soft_tissue: /muscle|vessel|nerve|gland|thyroid|lymph|ligament|carotid/i,
  cranium_facial: /skull|temporal|jaw|mandib|maxill|sinus|facial|muscle|nerve|tooth|tooth|dental/i, abdominal_cavity: /liver|gall|pancrea|stomach|intestin|colon|kidney|organ|duct|vessel|lymph|appendix/i,
  pelvis: /uter|ovary|testis|bladder|prostat|ureter|pelvic|muscle|vessel|ovarian|sacr/i, thoracic_cavity: /heart|lung|esophag|aort|vessel|organ|pleura|muscle|rib/i,
  lower_leg: /tibia|fibula|gastrocnem|soleus|tendon|compartment|nerve|fascia/i, chest_wall: /rib|sternum|muscle|cartilage|intercostal/i,
  abdomen_wall: /muscle|rectus|fascia|aponeuro/i, upper_arm: /humer|biceps|triceps|brachial|muscle|nerve|radius/i, forearm: /radius|ulna|muscle|tendon|nerve|vessel/i,
  sacral_region: /sacr|vertebr|nerve|joint|muscle/i,
};
let linked = 0;
for (const f of FILES) {
  const doc = read(f);
  (doc.conditions || []).forEach((c) => {
    if (c.taxonomy && subs[c.taxonomy.subRegion]) return;
    const sub = SUBMAP[c.id] || null;
    if (!sub || !subs[sub]) return;
    const re = TOK[sub];
    const structs = (subs[sub].structures || []).filter((id) => {
      const st = structById.get(id) || {};
      return re.test(id) || re.test((st.label || {}).en || '') || re.test((st.label || {}).ar || '');
    }).slice(0, 4);
    c.taxonomy = Object.assign({ subRegion: sub }, structs.length ? { structures: structs } : {});
    linked++;
  });
  writeJson(f, doc);
}
console.log('taxonomyLinked=' + linked);

/* ─────────── 4) وسم حالة التحقق من كود ICD-10 ─────────── */
const all = FILES.flatMap((f) => read(f).conditions);
for (const f of FILES) {
  const doc = read(f);
  (doc.conditions || []).forEach((c) => {
    c.icd10Status = VERIFIED.has(String(c.icd10)) ? 'verified' : 'unverified';
  });
  writeJson(f, doc);
}
const unverified = [...new Set(all.filter((c) => !VERIFIED.has(String(c.icd10))).map((c) => c.icd10 + ' (' + c.id + ')'))];

/* ─────────── 5) التحقق ─────────── */
let vout = '', vok = true;
try { vout = execSync('node scripts/validate-medical-library.js', { cwd: ROOT, encoding: 'utf8' }); }
catch (e) { vok = false; vout = (e.stdout || '') + (e.stderr || ''); }
console.log('--- validator ---\n' + vout.trim());

/* ─────────── 6) الواجهة: تبويب الأمراض/التشريح ─────────── */
const tabsPanel = [
  '// components/MedicalLibraryTabsPanel.tsx',
  '// تبويبان في نفس اللوحة: قائمة الأمراض (المكتبة) و مستكشف التشريح الهرمي (منطقة → منطقة فرعية → بنية → أمراض).',
  "import React, { useState } from 'react';",
  "import { Pressable, StyleSheet, Text, View } from 'react-native';",
  "import type { Language } from '../services/medical/diseaseLibrary';",
  "import { MedicalLibraryPanel } from './MedicalLibraryPanel';",
  "import { AnatomyExplorerPanel } from './AnatomyExplorerPanel';",
  "import { Palette, Radii } from '../constants/design';",
  '',
  'const LABELS = {',
  "  ar: { library: 'المكتبة الطبية', anatomy: 'التشريح (سم/مم)' },",
  "  en: { library: 'Medical library', anatomy: 'Anatomy (cm/mm)' },",
  "  fr: { library: 'Bibliothèque', anatomy: 'Anatomie (cm/mm)' },",
  '} as const;',
  '',
  'export function MedicalLibraryTabsPanel({ language }: { language: Language }) {',
  '  const t = LABELS[language] ?? LABELS.ar;',
  "  const [tab, setTab] = useState<'library' | 'anatomy'>(  'library'  );",
  '  return (',
  '    <View style={styles.wrap}>',
  '      <View style={styles.switchRow}>',
  '        <Pressable onPress={() => setTab(  \'library\'  )} style={[styles.switchBtn, tab === \'library\' && styles.switchActive]}>',
  "          <Text style={[styles.switchText, tab === 'library' && styles.switchTextActive]}>{t.library}</Text>",
  '        </Pressable>',
  '        <Pressable onPress={() => setTab(  \'anatomy\'  )} style={[styles.switchBtn, tab === \'anatomy\' && styles.switchActive]}>',
  "          <Text style={[styles.switchText, tab === 'anatomy' && styles.switchTextActive]}>{t.anatomy}</Text>",
  '        </Pressable>',
  '      </View>',
  '      {tab ===  \'anatomy\'  ? <AnatomyExplorerPanel language={language} /> : <MedicalLibraryPanel language={language} />}',
  '    </View>',
  '  );',
  '}',
  '',
  'export default MedicalLibraryTabsPanel;',
  '',
  'const styles = StyleSheet.create({',
  '  wrap: { gap: 10 },',
  '  switchRow: { flexDirection:  \'row\'  , gap: 8 },',
  '  switchBtn: { flex: 1, alignItems:  \'center\'  , paddingVertical: 9, borderRadius: Radii.md, backgroundColor: Palette.slate100 },',
  '  switchActive: { backgroundColor: Palette.teal600 },',
  '  switchText: { fontSize: 13, color: Palette.slate600 },',
  '  switchTextActive: { color: Palette.white, fontWeight:  \'700\'  },',
  '});',
  '',
].join('\n');
fs.writeFileSync(R('components/MedicalLibraryTabsPanel.tsx'), tabsPanel);

let uiPatched = 'no';
const bpsPath = R('screens/BodyPickerScreen.tsx');
let bps = fs.readFileSync(bpsPath, 'utf8');
if (bps.includes("from '../components/MedicalLibraryPanel'") && /<MedicalLibraryPanel[\s\S]{0,80}?\/>/.test(bps)) {
  bps = bps.replace("import { MedicalLibraryPanel } from '../components/MedicalLibraryPanel';",
    "import { MedicalLibraryTabsPanel } from '../components/MedicalLibraryTabsPanel';");
  bps = bps.replace(/<MedicalLibraryPanel(\s[^>]*?)\/>/g, '<MedicalLibraryTabsPanel$1/>');
  fs.writeFileSync(bpsPath, bps);
  uiPatched = 'yes';
}
console.log('uiPatched=' + uiPatched);

/* ─────────── 7) التوثيق العربي ─────────── */
const subCount = (id) => all.filter((c) => c.taxonomy && c.taxonomy.subRegion === id).length;
const lines = [];
lines.push('# التصنيف التشريحي الهرمي (حتى مستوى البنية الدقيقة)', '');
lines.push('المستويات: الجهاز/المنطقة الأساسية → المنطقة الفرعية → البنية المحددة (عظم، مفصل، رباط، عضلة، وتر، عصب، وعاء، عضو، غدة، لمف، غشاء، غضروف، جراب، لِفافة، فراغ، نسيج رخو).');
lines.push('عدد المناطق: ' + tax.regions.length + ' | المناطق الفرعية: ' + Object.keys(subs).length + ' | البنى: ' + structIds.size + ' | حالات مربوطة: ' + all.length + ' | بنى لها أمراض مربوطة: ' + [...structIds].filter((id) => all.some((c) => c.taxonomy && (c.taxonomy.structures || []).includes(id))).length, '');
lines.push('| المنطقة | المنطقة الفرعية | العربية | English | عدد البنى | أمراض مربوطة |');
lines.push('|---|---|---|---|---|---|');
tax.regions.forEach((r) => r.subRegions.forEach((s) => {
  lines.push('| ' + r.id + ' | ' + s.id + ' | ' + s.label.ar + ' | ' + s.label.en + ' | ' + (s.structures || []).length + ' | ' + subCount(s.id) + ' |');
}));
lines.push('', '## حالة التحقق من أكواد ICD-10', '', 'مُتحقَّق منه (' + (all.length - unverified.length) + '): ' + [...VERIFIED].join(', '), '', 'غير مُتحقَّق منه (' + unverified.length + '): ' + unverified.join(', '), '');
lines.push('ملاحظة: كل رمز في التصنيف هو إشارة تربط البنية بالحالة المرضية، وليس تشخيصًا. المحتوى تعليمي فقط ولا يغني عن الطبيب.');
fs.writeFileSync(R('docs/ANATOMY_GRANULARITY_AR.md'), lines.join('\n') + '\n');

/* ─────────── 8) فحص صياغة ملفات TS ─────────── */
const tsFiles = ['services/medical/regionTaxonomy.ts', 'services/medical/diseaseLibrary.ts', 'hooks/useMedicalLibrary.ts', 'services/medical/index.ts'];
for (const f of tsFiles) {
  const r = spawnSync('node', ['--experimental-strip-types', '--check', R(f)], { encoding: 'utf8' });
  console.log('syntax ' + f + ' -> ' + (r.status === 0 ? 'OK' : 'FAIL ' + (r.stderr || '').split('\n')[0]));
}

/* ─────────── 9) جدول الحالات للعرض ─────────── */
console.log('--- CONDITIONS (' + all.length + ') ---');
['data/medical/diseases.json', 'data/medical/organConditions.json', 'data/medical/regionalConditions.json'].forEach((f) => {
  const doc = read(f);
  (doc.conditions || []).forEach((c) => {
    console.log([(c.batch || '-'), c.icd10, c.icd10Status, (c.taxonomy && c.taxonomy.subRegion) || (Array.isArray(c.regions) ? c.regions[0] : '?'), (c.name || {}).ar, (c.name || {}).en].join(' | '));
  });
});
console.log('--- UNVERIFIED ICD-10 (' + unverified.length + ') ---');
unverified.forEach((u) => console.log('  ' + u));
console.log('--- sub-region disease counts ---');
Object.keys(subs).forEach((s) => console.log('  ' + s + ' = ' + subCount(s)));

/* ─────────── 10) ضغط الملفات المتغيّرة فقط ─────────── */
const changed = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' })
  .split('\n').map((l) => l.trim()).filter(Boolean)
  .filter((l) => !l.startsWith('D '))
  .map((l) => l.replace(/^[AMR?\s]{1,2}\s+/, '').replace(/^"|"$/g, ''))
  .filter((p) => p && !p.startsWith('node_modules'));
const manifest = changed.map((p) => {
  const buf = fs.readFileSync(R(p));
  const h = require('crypto').createHash('sha256').update(buf).digest('hex').slice(0, 16);
  return p + '  ' + buf.length + ' bytes  sha256:' + h;
});
const ZIP = '/home/user/bodymap-anatomy-taxonomy-update.zip';
try { fs.unlinkSync(ZIP); } catch (e) {}
const stage = '/home/user/stage';
fs.rmSync(stage, { recursive: true, force: true }); fs.mkdirSync(stage, { recursive: true });
fs.writeFileSync(path.join(stage, 'MANIFEST.txt'),
  'bodymap-anatomy-taxonomy-update — ' + new Date().toISOString().slice(0, 10) + '\n' +
  'الملفات المتغيّرة/المضافة فقط (مصدرها git status مقابل النسخة المستنسخة)\n\n' + manifest.join('\n') + '\n');
const z = spawnSync('zip', ['-r', '-q', ZIP, ...changed], { cwd: ROOT, encoding: 'utf8' });
if (z.status !== 0) console.log('ZIP ERROR: ' + (z.stderr || ''));
const z2 = spawnSync('zip', ['-j', '-q', ZIP, path.join(stage, 'MANIFEST.txt')], { encoding: 'utf8' });
console.log('--- ZIP ---');
console.log('file=' + ZIP + ' bytes=' + fs.statSync(ZIP).size + ' manifestAdd=' + (z2.status === 0));
console.log(execSync('unzip -l ' + ZIP, { encoding: 'utf8' }));
console.log('validatorPassed=' + vok);
