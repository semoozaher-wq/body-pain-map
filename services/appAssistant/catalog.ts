// services/appAssistant/catalog.ts
// ============================================================================
// كتالوج العناصر القابلة للوصف/التحديد (Visual Anchoring Catalog)
// ----------------------------------------------------------------------------
// كل عنصر له id ثابت + تسمية مترجمة + كلمات مفتاحية (aliases) + إحداثيات فعلية.
// الإحداثيات مأخوذة حرفيًا من:
//   • data/anatomyHotspots.json   (مواضع الأعضاء والعضلات على الخريطة)
//   • data/acupressurePoints.json (نقاط الضغط مع mapPosition)
// لا يوجد أي تخمين: ما ليس في البيانات لا يُدرَج.
// ============================================================================

import organDetailsData from '../../data/organDetails.json';
import internalOrgansData from '../../data/internalOrgans.json';
import acupressureData from '../../data/acupressurePoints.json';
import hotspotsData from '../../data/anatomyHotspots.json';
import type {
  AppScreen,
  BodyTab,
  BodyView,
  CatalogEntry,
  Coords,
  Lang,
  LocalizedText,
  Sex,
} from './types';

// ---------------------------------------------------------------------------
// تطبيع النص (يطابق منطق محرّك الفرز الطبي لضمان اتساق المطابقة)
// ---------------------------------------------------------------------------
const AR_DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;
const INVISIBLE_MARKS = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(INVISIBLE_MARKS, '')
    .replace(AR_DIACRITICS, '')
    .replace(/[\u0623\u0625\u0622\u0671]/g, '\u0627')
    .replace(/\u0649/g, '\u064a')
    .replace(/\u0626/g, '\u064a')
    .replace(/\u0624/g, '\u0648')
    .replace(/\u0629/g, '\u0647')
    .replace(/\s+/g, ' ')
    .trim();
}

const norm = (values: string[]): string[] =>
  values.map(normalize).filter(Boolean);

// ---------------------------------------------------------------------------
// تسميات الأعضاء بالإنجليزية/الفرنسية (تكملة لما هو ناقص في internalOrgans.json)
// ---------------------------------------------------------------------------
const ORGAN_NAMES_EN: Record<string, string> = {
  heart: 'Heart',
  lungs: 'Lungs',
  stomach: 'Stomach',
  liver: 'Liver',
  kidneys: 'Kidneys',
  thyroid: 'Thyroid Gland',
  uterus: 'Uterus',
  ovaries: 'Ovaries',
  testicles: 'Testicles',
  skin: 'Skin',
  esophagus: 'Esophagus',
  gallbladder: 'Gallbladder',
  pancreas: 'Pancreas',
  intestines: 'Intestines',
  appendix: 'Appendix',
  bladder: 'Bladder',
  prostate: 'Prostate',
  tonsils: 'Tonsils',
  'lymph-nodes': 'Lymph Nodes',
  'salivary-glands': 'Salivary Glands',
};

const ORGAN_NAMES_FR: Record<string, string> = {
  heart: 'Cœur',
  lungs: 'Poumons',
  stomach: 'Estomac',
  liver: 'Foie',
  kidneys: 'Reins',
  thyroid: 'Thyroïde',
  uterus: 'Utérus',
  ovaries: 'Ovaires',
  testicles: 'Testicules',
  skin: 'Peau',
  esophagus: 'Œsophage',
  gallbladder: 'Vésicule biliaire',
  pancreas: 'Pancréas',
  intestines: 'Intestins',
  appendix: 'Appendice',
  bladder: 'Vessie',
  prostate: 'Prostate',
  tonsils: 'Amygdales',
  'lymph-nodes': 'Ganglions lymphatiques',
  'salivary-glands': 'Glandes salivaires',
};

// كلمات مفتاحية إضافية للأعضاء (عربي/إنجليزي/فرنسي) — تُدمج مع الاسم الرسمي.
const ORGAN_ALIASES: Record<string, string[]> = {
  heart: ['قلب', 'القلب', 'قلبي', 'قلبى', 'heart', 'coeur', 'cœur'],
  lungs: ['رئه', 'الرئه', 'رئتين', 'الرئتين', 'lung', 'lungs', 'poumon', 'poumons'],
  stomach: ['معدة', 'المعده', 'معدتك', 'stomach', 'estomac'],
  liver: ['كبد', 'الكبد', 'liver', 'foie'],
  kidneys: ['كليه', 'الكليه', 'كليتين', 'الكليتين', 'kidney', 'kidneys', 'rein', 'reins'],
  thyroid: ['غدة درقية', 'الغده الدرقيه', 'الدرقيه', 'درقيه', 'thyroid', 'thyroide', 'thyroïde'],
  uterus: ['رحم', 'الرحم', 'uterus', 'womb', 'uterus'],
  ovaries: ['مبيض', 'المبيض', 'مبايض', 'ovary', 'ovaries', 'ovaire', 'ovaires'],
  testicles: ['خصية', 'الخصيه', 'خصيتين', 'testicle', 'testicles', 'testicule', 'testicules'],
  skin: ['جلد', 'الجلد', 'skin', 'peau'],
  esophagus: ['مريء', 'المريء', 'esophagus', 'oesophage'],
  gallbladder: ['مرارة', 'المراره', 'gallbladder', 'vesicule', 'vésicule'],
  pancreas: ['بنكرياس', 'البنكرياس', 'pancreas', 'pancreas'],
  intestines: ['امعاء', 'الامعاء', 'مصران', 'intestine', 'intestines', 'intestin'],
  appendix: ['زائدة', 'الزائده', 'appendix', 'appendice'],
  bladder: ['مثانة', 'المثانه', 'bladder', 'vessie'],
  prostate: ['بروستاتا', 'البروستاتا', 'prostate'],
  tonsils: ['لوز', 'اللوز', 'لوزتين', 'tonsil', 'tonsils', 'amygdale', 'amygdales'],
  'lymph-nodes': ['غدد ليمفاويه', 'الغدد الليمفاويه', 'lymph', 'lymph nodes', 'ganglion'],
  'salivary-glands': ['غدد لعابيه', 'الغدد اللعابيه', 'salivary', 'salivary glands', 'salivaire'],
};

// ---------------------------------------------------------------------------
// استخراج الإحداثيات من hotspots
// ---------------------------------------------------------------------------
interface RawHotspot {
  id: string;
  label: string;
  muscleId?: string;
  organId?: string;
  x: number;
  y: number;
  view: BodyView;
  type: 'muscle' | 'organ';
  gender?: Sex;
}
const HOTSPOTS = hotspotsData as unknown as RawHotspot[];

function organCoords(organId: string): Coords | undefined {
  const spot = HOTSPOTS.find((h) => h.type === 'organ' && h.organId === organId);
  if (!spot) return undefined;
  return { x: spot.x, y: spot.y, view: spot.view };
}

// ---------------------------------------------------------------------------
// الشاشات (Screens)
// ---------------------------------------------------------------------------
interface ScreenDef {
  id: AppScreen;
  label: LocalizedText;
  aliases: string[];
}
const SCREEN_DEFS: ScreenDef[] = [
  {
    id: 'welcome',
    label: { ar: 'الصفحة الرئيسية', en: 'Home', fr: 'Accueil' },
    aliases: ['الرئيسيه', 'الرئيسية', 'البدايه', 'home', 'accueil', 'الصفحة الرئيسية'],
  },
  {
    id: 'body',
    label: { ar: 'خريطة الجسم', en: 'Body Map', fr: 'Carte du corps' },
    aliases: ['خريطة الجسم', 'الجسم', 'الخريطه', 'body', 'body map', 'carte', 'corps'],
  },
  {
    id: 'history',
    label: { ar: 'سجل الألم', en: 'Pain History', fr: 'Historique de la douleur' },
    aliases: ['سجل', 'السجل', 'سجل الالم', 'التاريخ', 'history', 'log', 'historique'],
  },
  {
    id: 'healthInfo',
    label: { ar: 'المعلومات الصحية', en: 'Health Info', fr: 'Infos santé' },
    aliases: ['المعلومات الصحيه', 'معلومات صحيه', 'health', 'health info', 'infos sante'],
  },
  {
    id: 'assistant',
    label: { ar: 'المساعد الذكي', en: 'Assistant', fr: 'Assistant' },
    aliases: ['المساعد', 'المساعد الذكي', 'assistant'],
  },
  {
    id: 'details',
    label: { ar: 'تفاصيل الألم', en: 'Pain Details', fr: 'Détails de la douleur' },
    aliases: ['التفاصيل', 'تفاصيل الالم', 'details'],
  },
  {
    id: 'results',
    label: { ar: 'النتائج', en: 'Results', fr: 'Résultats' },
    aliases: ['النتائج', 'results'],
  },
  {
    id: 'settings',
    label: { ar: 'الإعدادات', en: 'Settings', fr: 'Réglages' },
    aliases: ['الإعدادات', 'الاعدادات', 'اعدادات', 'الضبط', 'settings', 'reglages', 'réglages'],
  },
];

// ---------------------------------------------------------------------------
// تبويبات الخريطة (Body tabs)
// ---------------------------------------------------------------------------
interface TabDef {
  id: BodyTab;
  label: LocalizedText;
  aliases: string[];
}
const TAB_DEFS: TabDef[] = [
  {
    id: 'muscles',
    label: { ar: 'العضلات', en: 'Muscles', fr: 'Muscles' },
    aliases: ['العضلات', 'عضلات', 'العضله', 'muscle', 'muscles'],
  },
  {
    id: 'organs',
    label: { ar: 'الأعضاء الداخلية', en: 'Internal Organs', fr: 'Organes internes' },
    aliases: ['الاعضاء', 'الاعضاء الداخليه', 'اعضاء', 'التشريح', 'organs', 'internal organs', 'organes'],
  },
  {
    id: 'acupressure',
    label: { ar: 'نقاط الضغط', en: 'Acupressure', fr: 'Acupression' },
    aliases: ['نقاط الضغط', 'الضغط', 'الابر الصينيه', 'الوخز', 'acupressure', 'acupuncture', 'acupression'],
  },
  {
    id: 'naturalRelief',
    label: { ar: 'التخفيف الطبيعي', en: 'Natural Relief', fr: 'Soulagement naturel' },
    aliases: ['التخفيف الطبيعي', 'طبيعي', 'natural relief', 'naturel'],
  },
  {
    id: 'medicalLibrary',
    label: { ar: 'المكتبة الطبية', en: 'Medical Library', fr: 'Bibliothèque médicale' },
    aliases: ['المكتبه الطبيه', 'المكتبه', 'مكتبه طبيه', 'medical library', 'library', 'bibliotheque'],
  },
  {
    id: 'drugLookup',
    label: { ar: 'الأدوية', en: 'Medications', fr: 'Médicaments' },
    aliases: ['الادويه', 'ادويه', 'دوا', 'medications', 'drugs', 'medicaments'],
  },
];

// ---------------------------------------------------------------------------
// بناء الكتالوج
// ---------------------------------------------------------------------------
const entries: CatalogEntry[] = [];

// شاشات
for (const def of SCREEN_DEFS) {
  entries.push({
    id: `screen:${def.id}`,
    kind: 'screen',
    label: def.label,
    aliases: norm([def.label.ar, def.label.en, def.label.fr, ...def.aliases]),
    screen: def.id,
  });
}

// تبويبات
for (const def of TAB_DEFS) {
  entries.push({
    id: `tab:${def.id}`,
    kind: 'tab',
    label: def.label,
    aliases: norm([def.label.ar, def.label.en, def.label.fr, ...def.aliases]),
    tab: def.id,
    screen: 'body',
  });
}

// أعضاء
interface RawOrganDetail { name: string }
const ORGAN_DETAILS = organDetailsData as unknown as Record<string, RawOrganDetail>;
interface RawInternalOrgan { id: string; nameAr: string; nameEn: string }
const INTERNAL_ORGANS = internalOrgansData as unknown as Record<
  string,
  { labelAr: string; organs: RawInternalOrgan[] }
>;

const organRegion: Record<string, string> = {};
for (const [regionKey, group] of Object.entries(INTERNAL_ORGANS)) {
  for (const organ of group.organs ?? []) organRegion[organ.id] = regionKey;
}

for (const organId of Object.keys(ORGAN_DETAILS)) {
  const detail = ORGAN_DETAILS[organId];
  const internal = Object.values(INTERNAL_ORGANS)
    .flatMap((group) => group.organs ?? [])
    .find((o) => o.id === organId);
  const arName = detail?.name ?? internal?.nameAr ?? organId;
  const enName = internal?.nameEn ?? ORGAN_NAMES_EN[organId] ?? organId;
  const frName = ORGAN_NAMES_FR[organId] ?? enName;
  entries.push({
    id: `organ:${organId}`,
    kind: 'organ',
    label: { ar: arName, en: enName, fr: frName },
    aliases: norm([arName, enName, frName, ...(ORGAN_ALIASES[organId] ?? [])]),
    tab: 'organs',
    screen: 'body',
    region: organRegion[organId],
    coords: organCoords(organId),
    meta: { organId },
  });
}

// نقاط الضغط
interface RawPoint {
  id: string;
  code: string;
  region: string;
  traditionalName?: string;
  mapPosition: { x: number; y: number; side: string };
  name: { ar: string; en: string; fr: string };
}
const POINTS = (acupressureData as unknown as { points: RawPoint[] }).points;

const POINT_REGION_LABELS: Record<string, LocalizedText> = {
  hand: { ar: 'اليد', en: 'Hand', fr: 'Main' },
  inner_wrist: { ar: 'الرسغ الداخلي', en: 'Inner wrist', fr: 'Poignet interne' },
  base_of_skull: { ar: 'قاعدة الجمجمة', en: 'Base of skull', fr: 'Base du crâne' },
  inner_ankle: { ar: 'الكاحل الداخلي', en: 'Inner ankle', fr: 'Cheville interne' },
};

for (const point of POINTS) {
  const regionLabel = POINT_REGION_LABELS[point.region];
  const aliases = [point.name.ar, point.name.en, point.name.fr, point.code, point.traditionalName ?? ''];
  if (regionLabel) aliases.push(regionLabel.ar, regionLabel.en, regionLabel.fr);
  entries.push({
    id: `point:${point.id}`,
    kind: 'point',
    label: point.name,
    aliases: norm(aliases),
    tab: 'acupressure',
    screen: 'body',
    region: point.region,
    code: point.code,
    coords: { x: point.mapPosition.x, y: point.mapPosition.y, view: 'front' },
    meta: { pointId: point.id, side: point.mapPosition.side },
  });
}

// مناطق العضلات (muscle hotspots مجمّعة حسب المجموعة)
const MUSCLE_GROUP_LABELS: Record<string, LocalizedText> = {
  head: { ar: 'الرأس', en: 'Head', fr: 'Tête' },
  neck: { ar: 'الرقبة', en: 'Neck', fr: 'Cou' },
  chest: { ar: 'الصدر', en: 'Chest', fr: 'Poitrine' },
  abs: { ar: 'البطن', en: 'Abdomen', fr: 'Abdomen' },
  biceps: { ar: 'العضلة ذات الرأسين', en: 'Biceps', fr: 'Biceps' },
  forearm: { ar: 'الساعد', en: 'Forearm', fr: 'Avant-bras' },
  hands: { ar: 'اليدان', en: 'Hands', fr: 'Mains' },
  quadriceps: { ar: 'الفخذ الأمامي', en: 'Front thigh', fr: 'Avant de la cuisse' },
  knees: { ar: 'الركبة', en: 'Knee', fr: 'Genou' },
  calves: { ar: 'السمانة', en: 'Calf', fr: 'Mollet' },
  ankles: { ar: 'الكاحل', en: 'Ankle', fr: 'Cheville' },
  feet: { ar: 'القدم', en: 'Foot', fr: 'Pied' },
  deltoids: { ar: 'الكتف', en: 'Shoulder', fr: 'Épaule' },
  obliques: { ar: 'الخصر الجانبي', en: 'Side abdomen', fr: 'Côté de l’abdomen' },
  trapezius: { ar: 'أعلى الكتف', en: 'Upper shoulder', fr: 'Haut de l’épaule' },
  upper: { ar: 'أعلى الظهر', en: 'Upper back', fr: 'Haut du dos' },
  lower: { ar: 'أسفل الظهر', en: 'Lower back', fr: 'Bas du dos' },
  mid: { ar: 'وسط الظهر', en: 'Mid back', fr: 'Milieu du dos' },
  gluteal: { ar: 'الأرداف', en: 'Glutes', fr: 'Fessiers' },
  hamstring: { ar: 'خلف الفخذ', en: 'Hamstrings', fr: 'Ischio-jambiers' },
  triceps: { ar: 'العضلة ثلاثية الرؤوس', en: 'Triceps', fr: 'Triceps' },
  tibialis: { ar: 'الظنبوب', en: 'Shin', fr: 'Tibia' },
  hair: { ar: 'فروة الرأس', en: 'Scalp', fr: 'Cuir chevelu' },
};

const seenGroups = new Set<string>();
// مرادفات عامة لمنطقة الظهر (تساعد «ضهري بيوجعني» على تحديد منطقة ظهر حقيقية).
const BACK_ALIASES = ['ضهر', 'ضهري', 'الظهر', 'ظهرى', 'back', 'dos'];
// مرادفات إضافية لكل مجموعة عضلية: تسمح بالضمائر والأشكال الشائعة داخل الجملة
// («تحت صدري بشوية» → «صدر»/«صدري») دون اختراع إحداثيات، اعتمادًا على إحداثيات المجموعة الحقيقية.
const GROUP_EXTRA_ALIASES: Record<string, string[]> = {
  upper: BACK_ALIASES,
  lower: BACK_ALIASES,
  chest: ['صدر', 'صدري', 'صدرى', 'chest', 'poitrine'],
};

// ---------------------------------------------------------------------------
// مرادفات إضافية للمناطق بالصيغ الدارجة والضمائر الملتصقة (عامية مصرية/فصحى مبسّطة)
// ---------------------------------------------------------------------------
// الهدف: أن يفهم المساعد وصف المستخدم الطبيعي («جنبي بيوجعني»، «كتفي»، «بطني»، «ضهري»)
// دون أن يطلب منه الضغط على الخريطة. لا اختراع إحداثيات: المرادفات تُطابَق مع المناطق
// الحقيقية الموجودة في anatomyHotspots.json فقط.
const REGION_EXTRA_ALIASES: Record<string, string[]> = {
  obliques: ['جنبي', 'جنبه', 'جنبها', 'خصر', 'خصري', 'الخصر', 'خواصري', 'flank', 'side', 'cote', 'côté'],
  deltoids: ['كتف', 'كتفي', 'كتفه', 'كتفها', 'الكتفين', 'shoulder', 'shoulders', 'epaule', 'épaule'],
  abs: ['بطن', 'بطني', 'بطنه', 'كرش', 'كرشي', 'abdomen', 'belly', 'ventre'],
  neck: ['رقبه', 'رقبتي', 'الرقبه', 'neck', 'cou'],
  head: ['راس', 'راسي', 'الراس', 'head', 'tete', 'tête'],
  knees: ['ركبه', 'ركبتي', 'الركبه', 'knee', 'genou'],
  feet: ['قدم', 'قدمي', 'القدم', 'foot', 'feet', 'pied'],
  hands: ['ايد', 'ايدي', 'الايد', 'يد', 'يدي', 'hand', 'hands', 'main'],
  forearm: ['ساعد', 'ساعدي', 'الساعد', 'forearm', 'avant-bras'],
  quadriceps: ['فخذ', 'فخذي', 'الفخذ', 'thigh', 'cuisse'],
  calves: ['سمانه', 'سمانتي', 'السمانه', 'calf', 'mollet'],
  ankles: ['كاحل', 'كاحلي', 'الكاحل', 'ankle', 'cheville'],
  gluteal: ['ارداف', 'اردافي', 'glutes', 'fessiers'],
  biceps: ['باي', 'biceps'],
  triceps: ['تراي', 'triceps'],
  trapezius: ['ترابيس', 'trapezius'],
  hamstring: ['خلف الفخذ', 'hamstrings'],
  tibialis: ['ظنبوب', 'shin'],
  hair: ['فروه', 'scalp'],
};

for (const spot of HOTSPOTS) {
  if (spot.type !== 'muscle' || !spot.muscleId) continue;
  const group = spot.muscleId.split('-')[0];
  if (seenGroups.has(`${group}-${spot.view}`)) continue;
  seenGroups.add(`${group}-${spot.view}`);
  const label = MUSCLE_GROUP_LABELS[group];
  if (!label) continue;
  const extra = [...(GROUP_EXTRA_ALIASES[group] ?? []), ...(REGION_EXTRA_ALIASES[group] ?? [])];
  entries.push({
    id: `region:${group}:${spot.view}`,
    kind: 'region',
    label,
    aliases: norm([label.ar, label.en, label.fr, group, ...extra]),
    tab: 'muscles',
    screen: 'body',
    view: spot.view,
    region: group,
    coords: { x: spot.x, y: spot.y, view: spot.view },
    meta: { group },
  });
}

// ---------------------------------------------------------------------------
// منطقة «وسط الظهر» (Mid back)
// ---------------------------------------------------------------------------
// مشكلة سابقة: «وسط الظهر» كان يُطابَق مع «أعلى الظهر» (upper) لأن كلا منطقتي الظهر
// تتشاركان مرادفات (ضهر/الظهر) وكانت أول مطابقة تفوز. هنا نضيف منطقة «وسط الظهر»
// بإحداثيات مشتقّة من متوسط إحداثيات أعلى/أسفل الظهر الحقيقية على العرض الخلفي
// (لا اختراع إحداثيات: متوسط نقطتين موجودتين فعلاً في anatomyHotspots.json).
const MID_BACK_COORDS: Coords = { x: 40, y: 38, view: 'back' };
const MID_BACK_ALIASES = ['وسط الظهر', 'نص الظهر', 'في النص', 'النص', 'وسط', 'نص', 'middle back', 'mid back', 'milieu du dos'];
entries.push({
  id: 'region:mid:back',
  kind: 'region',
  label: { ar: 'وسط الظهر', en: 'Mid back', fr: 'Milieu du dos' },
  aliases: norm([...MID_BACK_ALIASES, 'region:mid:back']),
  tab: 'muscles',
  screen: 'body',
  view: 'back',
  region: 'mid',
  coords: MID_BACK_COORDS,
  meta: { group: 'mid' },
});

const BACK_WORD_TOKENS = ['ظهر', 'ضهر', 'back', 'dos'];
const MID_WORD_TOKENS = ['وسط', 'نص', 'middle', 'mid', 'milieu'];
/**
 * هل يشير النص إلى «وسط الظهر» تحديدًا؟
 *   • «وسط/نص» + كلمة ظهر  ⇒ وسط الظهر.
 *   • «وسط»/«نص»/«النص»/«في النص» وحدها ⇒ وسط الظهر (سياق تحديد ألم الظهر).
 * ملاحظة: «وسط البطن» أو «وسط الصدر» لا تُعدّ ظهرًا (لا تحتوي كلمة ظهر وليست الصيغة المجرّدة).
 */
export function isMidBackTerm(term: string): boolean {
  const n = normalize(term);
  if (!n) return false;
  const hasMid = MID_WORD_TOKENS.some((w) => { const nw = normalize(w); return nw && n.includes(nw); });
  if (!hasMid) return false;
  const hasBack = BACK_WORD_TOKENS.some((w) => { const nw = normalize(w); return nw && n.includes(nw); });
  if (hasBack) return true;
  return ['وسط', 'نص', 'النص', 'في النص'].some((w) => n === normalize(w));
}

// ---------------------------------------------------------------------------
// واجهة الاستعلام
// ---------------------------------------------------------------------------
export const CATALOG: CatalogEntry[] = entries;

const byId = new Map<string, CatalogEntry>(entries.map((e) => [e.id, e]));

export function getEntry(id: string): CatalogEntry | undefined {
  return byId.get(id);
}

export function entriesByKind(kind: CatalogEntry['kind']): CatalogEntry[] {
  return entries.filter((e) => e.kind === kind);
}

/** كل العناصر التي تطابق مصطلحًا نصيًا (بعد التطبيع)، مرتّبة بحسب الدقة. */
export function findTargets(term: string, kinds?: CatalogEntry['kind'][]): CatalogEntry[] {
  const needle = normalize(term);
  if (!needle) return [];
  const pool = kinds ? entries.filter((e) => kinds.includes(e.kind)) : entries;
  const scored: Array<{ entry: CatalogEntry; score: number }> = [];
  for (const entry of pool) {
    let best = 0;
    for (const alias of entry.aliases) {
      if (!alias) continue;
      if (alias === needle) best = Math.max(best, 100);
      else if (alias.startsWith(needle) || needle.startsWith(alias)) best = Math.max(best, 70);
      else if (alias.includes(needle)) best = Math.max(best, 50);
      else if (needle.includes(alias)) best = Math.max(best, 40);
    }
    if (best > 0) scored.push({ entry, score: best });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.map((s) => s.entry);
}

/** أول عنصر يطابق مصطلحًا ضمن أنواع محدّدة. */
export function findTarget(term: string, kinds?: CatalogEntry['kind'][]): CatalogEntry | undefined {
  return findTargets(term, kinds)[0];
}

/** العناصر المرئية حاليًا على الخريطة (للفهم البصري). */
export function visibleEntries(state: {
  currentTab: BodyTab;
  currentBodyView: BodyView;
  currentSex: Sex;
}): CatalogEntry[] {
  return entries.filter((entry) => {
    if (entry.tab !== state.currentTab) return false;
    if (entry.coords && entry.coords.view !== state.currentBodyView) return false;
    if (entry.kind === 'organ' && entry.id === 'organ:uterus' && state.currentSex !== 'female') return false;
    if (entry.kind === 'organ' && entry.id === 'organ:ovaries' && state.currentSex !== 'female') return false;
    return true;
  });
}

export function labelFor(entry: CatalogEntry, lang: Lang): string {
  return entry.label[lang] ?? entry.label.ar;
}
