// tests/knowledgeRetrieval.verify.runner.ts
// ============================================================================
// مُشغّل تحقّق موسّع لطبقة المعرفة الطبية + الاسترجاع (Medical Knowledge Retrieval).
// يُنتج JSON منظّمًا على stdout ليقرأه اختبار node --test.
//
// لا يتصل بالشبكة. يُثبت فعليًا (باسترجاع حقيقي من بيانات المشروع):
//   1) التغطية الفعلية لكل فئة مطلوبة عبر الاسترجاع:
//      muscles / bones / joints / tendons / ligaments / nerves / vessels /
//      organs / regions / red flags.
//   2) دعم العربية والإنجليزية والفرنسية في الاسترجاع.
//   3) سلامة المصادر: لا مصدر عام (registry root مثل https://medlineplus.gov/)
//      يُعامل كدليل على معلومة بلا مصدر مباشر؛ وكل عنصر مُسترجع يحمل مصدرًا مباشرًا.
// ============================================================================

import {
  retrieveMedicalKnowledge,
  getKnowledgeCoverage,
  NO_RELIABLE_KNOWLEDGE,
  type KnowledgeCategory,
  type KnowledgeItem,
} from '../services/medical/knowledgeRetrieval';
import type { Language } from '../services/medical/diseaseLibrary';
import sourcesData from '../data/medical/sources.json';

// روابط جذرية عامة (registry roots) — لا تُعدّ مصدرًا مباشرًا لمعلومة بعينها.
const GENERIC_URLS = new Set(
  (sourcesData as { sources: { url: string }[] }).sources.map((s) =>
    s.url.trim().toLowerCase().replace(/\/+$/, ''),
  ),
);
const isGeneric = (url: string) => GENERIC_URLS.has(String(url).trim().toLowerCase().replace(/\/+$/, ''));

// ── (1) التغطية الفعلية لكل فئة عبر استرجاع حقيقي ─────────────────────────────
// لكل فئة: استعلام حقيقي + الفئة التشريحية المتوقّعة في النتائج.
const CATEGORY_PROBES: { key: string; query: string; expect: KnowledgeCategory[] }[] = [
  { key: 'muscles', query: 'العضلة القصية الترقوية', expect: ['muscle', 'fascia'] },
  { key: 'bones', query: 'الترقوة', expect: ['bone', 'joint', 'cartilage', 'bursa'] },
  { key: 'joints', query: 'مفصل الفك الصدغي', expect: ['joint', 'cartilage', 'bursa'] },
  { key: 'tendons', query: 'الوتر الرضفي', expect: ['tendon'] },
  { key: 'ligaments', query: 'الرباط الصليبي الأمامي', expect: ['ligament'] },
  { key: 'nerves', query: 'الجذور العصبية العنقية', expect: ['nerve'] },
  { key: 'vessels', query: 'الشريان السباتي', expect: ['vessel'] },
  { key: 'organs', query: 'المعدة', expect: ['organ', 'gland'] },
  { key: 'regions', query: 'الركبة', expect: ['region'] },
];

const categories = CATEGORY_PROBES.map((p) => {
  const r = retrieveMedicalKnowledge(p.query, 'ar');
  const match = r.items.find((i) => p.expect.includes(i.category));
  return {
    key: p.key,
    query: p.query,
    expect: p.expect,
    status: r.status,
    found: Boolean(match),
    matchedName: match?.name ?? null,
    matchedCategory: match?.category ?? null,
    categoriesReturned: r.categories,
  };
});

// ── Red Flags عبر استرجاع حقيقي ───────────────────────────────────────────────
const REDFLAG_PROBES = ['ألم في الصدر مع ضيق نفس', 'عرق النسا', 'صداع نصفي', 'التهاب السحايا'];
const redFlags = REDFLAG_PROBES.map((query) => {
  const r = retrieveMedicalKnowledge(query, 'ar');
  const withRf = r.items.filter((i) => i.hasRedFlags && i.redFlags.length > 0);
  return {
    query,
    status: r.status,
    itemCount: r.items.length,
    redFlagCount: withRf.length,
    found: withRf.length > 0,
    sampleRedFlag: withRf[0]?.redFlags?.slice(0, 80) ?? null,
    sampleName: withRf[0]?.name ?? null,
  };
});

// ── (2) دعم اللغات ar / en / fr عبر استرجاع حقيقي ─────────────────────────────
const LANG_PROBES: { lang: Language; query: string; expectName: string }[] = [
  { lang: 'ar', query: 'صداع نصفي', expectName: 'الصداع النصفي' },
  { lang: 'en', query: 'migraine', expectName: 'Migraine' },
  { lang: 'fr', query: 'migraine', expectName: 'Migraine' },
  { lang: 'en', query: 'back pain', expectName: 'Mechanical low back pain' },
  { lang: 'fr', query: 'lombalgie', expectName: 'Lombalgie' },
  { lang: 'fr', query: 'sciatique', expectName: 'Sciatique' },
];

const multilingual = LANG_PROBES.map((p) => {
  const r = retrieveMedicalKnowledge(p.query, p.lang);
  const top = r.items[0];
  return {
    lang: p.lang,
    query: p.query,
    status: r.status,
    resultLanguage: r.language,
    topName: top?.name ?? null,
    localizedToRequestedLanguage: top ? top.name.includes(p.expectName) : false,
  };
});

// ── (3) سلامة المصادر: لا مصدر عام يُعامل كدليل ───────────────────────────────
const SOURCE_PROBES = [
  'الترقوة',
  'مفصل الفك الصدغي',
  'الوتر الرضفي',
  'الشريان السباتي',
  'الغدة الدرقية',
  'الركبة',
  'صداع نصفي',
  'ألم في الصدر مع ضيق نفس',
  'عرق النسا',
  'ألم في المعدة',
  'التهاب المفاصل',
  'متلازمة مخرج الصدر',
  'الجلوكوما',
  'احتشاء عضلة القلب',
];

let anyItemWithoutSource = false;
let conditionGenericSourceUrl = false;
const conditionGenericUsages: string[] = [];
const noSourceItems: string[] = [];
const collected: KnowledgeItem[] = [];
for (const q of SOURCE_PROBES) {
  const r = retrieveMedicalKnowledge(q, 'ar');
  for (const item of r.items) {
    collected.push(item);
    if (item.sources.length === 0) {
      anyItemWithoutSource = true;
      noSourceItems.push(`${q} -> ${item.id}`);
    }
    // المشكلة كانت في الحالات المرضية: كان يُلحَق بها مصدر MedlinePlus العام عند غياب
    // مصدر مباشر. نتحقّق أن أي حالة مرضية مُسترجَعة لا تحمل رابطًا جذريًا عامًا.
    if (item.kind === 'condition') {
      for (const s of item.sources) {
        if (isGeneric(s.url)) {
          conditionGenericSourceUrl = true;
          conditionGenericUsages.push(`${q} -> ${item.id} -> ${s.url}`);
        }
      }
    }
  }
}

// الحالات بلا مصدر مباشر يجب ألّا تظهر كمعرفة موثوقة (تُستبعد).
const NO_SOURCE_CONDITION_IDS = ['local:thoracic-outlet', 'local:glaucoma', 'local:myocardial-infarction'];
const leakedNoSourceConditions = collected
  .filter((i) => NO_SOURCE_CONDITION_IDS.includes(i.id))
  .map((i) => i.id);

// ملاحظة: عناصر البنى/المناطق/الأعراض تحمل مصدر provenance للـdataset الذي جاءت منه
// (z-anatomy / BodyParts3D / HPO) — وهذا مصدرها المباشر، وليس fallback عام.
const provenanceByKind: Record<string, number> = {};
for (const item of collected) {
  if (item.kind !== 'condition') provenanceByKind[item.kind] = (provenanceByKind[item.kind] ?? 0) + 1;
}

const sources = {
  probes: SOURCE_PROBES.length,
  itemsChecked: collected.length,
  // كل عنصر مُسترجع يحمل مصدرًا (لا معرفة بلا مصدر)
  allItemsHaveSources: !anyItemWithoutSource,
  noSourceItems,
  // الحالات المرضية: لا مصدر عام يُعامل كدليل
  conditionAnyGenericSourceUrl: conditionGenericSourceUrl,
  conditionGenericUsages,
  // الحالات بلا مصدر مباشر تُستبعد ولا تُقدَّم كمعرفة موثوقة
  leakedNoSourceConditions,
  noSourceConditionExcluded: leakedNoSourceConditions.length === 0,
  provenanceItemsByKind: provenanceByKind,
};

// ── التغطية (عدد العناصر المتاحة في كل فئة) ───────────────────────────────────
const coverage = getKnowledgeCoverage();

const out = {
  categories,
  redFlags,
  multilingual,
  sources,
  coverage,
  constants: { NO_RELIABLE_KNOWLEDGE },
};

process.stdout.write(JSON.stringify(out));
