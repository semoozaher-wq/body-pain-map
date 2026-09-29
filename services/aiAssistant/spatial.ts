// services/appAssistant/spatial.ts
// ============================================================================
// الفهم المكاني (Spatial Understanding)
// ----------------------------------------------------------------------------
// يستنتج العلاقات النسبية بين العناصر من إحداثياتها الفعلية (0..100).
// اصطلاح الإحداثيات: y=0 أعلى الصورة، x=0 يسار الشاشة (نفس اصطلاح الخريطة).
//   فوق  → y أصغر   |  تحت → y أكبر
//   يمين → x أكبر   |  شمال → x أصغر
// لا يعتمد على تخمين لغوي — فقط على الإحداثيات المخزّنة في الكتالوج.
// ============================================================================

import { labelFor } from './catalog';
import type { CatalogEntry, Coords, Lang, LocalizedText } from './types';

export type Direction = 'above' | 'below' | 'left' | 'right' | 'near' | 'between';

const DIRECTION_LABELS: Record<Direction, LocalizedText> = {
  above: { ar: 'فوق', en: 'above', fr: 'au-dessus de' },
  below: { ar: 'تحت', en: 'below', fr: 'sous' },
  left: { ar: 'على شمال', en: 'to the left of', fr: 'à gauche de' },
  right: { ar: 'على يمين', en: 'to the right of', fr: 'à droite de' },
  near: { ar: 'قريب من', en: 'near', fr: 'près de' },
  between: { ar: 'بين', en: 'between', fr: 'entre' },
};

/** المسافة الإقليدية بين إحداثيين. */
function distance(a: Coords, b: Coords): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * يرتّب المرشّحين بحسب ملاءمتهم لاتجاه معيّن انطلاقًا من عنصر مرجعي.
 * يعيد قائمة مرتّبة (الأقرب/الأنسب أولًا).
 */
export function candidatesInDirection(
  reference: Coords,
  candidates: CatalogEntry[],
  direction: Direction,
): CatalogEntry[] {
  const withCoords = candidates.filter((c) => c.coords);
  const scored: Array<{ entry: CatalogEntry; score: number }> = [];

  for (const entry of withCoords) {
    const c = entry.coords as Coords;
    const dx = c.x - reference.x;
    const dy = c.y - reference.y;
    let primary = 0; // المسافة في اتجاه البحث
    let secondary = 0; // الانحراف الجانبي
    let valid = true;

    switch (direction) {
      case 'above':
        primary = -dy;
        secondary = Math.abs(dx);
        valid = dy < -0.5;
        break;
      case 'below':
        primary = dy;
        secondary = Math.abs(dx);
        valid = dy > 0.5;
        break;
      case 'right':
        primary = dx;
        secondary = Math.abs(dy);
        valid = dx > 0.5;
        break;
      case 'left':
        primary = -dx;
        secondary = Math.abs(dy);
        valid = dx < -0.5;
        break;
      case 'near':
      case 'between':
        primary = distance(reference, c);
        secondary = 0;
        break;
    }
    if (!valid) continue;
    // نفضّل الأقرب في الاتجاه مع أقل انحراف جانبي.
    scored.push({ entry, score: primary + secondary * 0.6 });
  }

  scored.sort((a, b) => a.score - b.score);
  return scored.map((s) => s.entry);
}

/** أقرب عنصر في اتجاه معيّن، مع استثناء العنصر المرجعي نفسه. */
export function nearestInDirection(
  reference: CatalogEntry,
  candidates: CatalogEntry[],
  direction: Direction,
): CatalogEntry | null {
  if (!reference.coords) return null;
  const pool = candidates.filter((c) => c.id !== reference.id && c.coords);
  return candidatesInDirection(reference.coords, pool, direction)[0] ?? null;
}

/** العنصر الأقرب عمومًا (بأي اتجاه). */
export function nearestOverall(reference: CatalogEntry, candidates: CatalogEntry[]): CatalogEntry | null {
  if (!reference.coords) return null;
  const pool = candidates.filter((c) => c.id !== reference.id && c.coords);
  return candidatesInDirection(reference.coords, pool, 'near')[0] ?? null;
}

/**
 * يصف موضع عنصر بالنسبة لعنصر آخر: "القلب فوق المعدة قليلًا".
 */
export function describeSpatialRelation(
  subject: CatalogEntry,
  reference: CatalogEntry,
  lang: Lang,
): LocalizedText | null {
  if (!subject.coords || !reference.coords) return null;
  const dx = subject.coords.x - reference.coords.x;
  const dy = subject.coords.y - reference.coords.y;
  const vertical = Math.abs(dy) >= Math.abs(dx);
  let dir: Direction;
  if (vertical) dir = dy < 0 ? 'above' : 'below';
  else dir = dx < 0 ? 'left' : 'right';

  const subj = labelFor(subject, lang);
  const ref = labelFor(reference, lang);
  const dirWord = DIRECTION_LABELS[dir][lang];

  return {
    ar: `${subj} ${dirWord} ${ref}.`,
    en: `${subj} is ${dirWord} ${ref}.`,
    fr: `${subj} est ${dirWord} ${ref}.`,
  };
}

/**
 * يصف موقع عنصر على الخريطة وصفًا عامًا (منتصف/أعلى/أسفل + يمين/شمال + الجانب).
 * يستخدم الإحداثيات الفعلية فقط.
 */
export function describePosition(entry: CatalogEntry, lang: Lang): LocalizedText | null {
  if (!entry.coords) return null;
  const { x, y } = entry.coords;
  const name = labelFor(entry, lang);

  const vBand = y < 33 ? 'upper' : y > 66 ? 'lower' : 'middle';
  const hBand = x < 42 ? 'left' : x > 58 ? 'right' : 'center';

  const V: Record<string, LocalizedText> = {
    upper: { ar: 'في الجزء العلوي', en: 'in the upper part', fr: 'dans la partie supérieure' },
    middle: { ar: 'في المنتصف', en: 'in the middle', fr: 'au milieu' },
    lower: { ar: 'في الجزء السفلي', en: 'in the lower part', fr: 'dans la partie inférieure' },
  };
  const H: Record<string, LocalizedText> = {
    left: { ar: 'ناحية اليسار', en: 'toward the left', fr: 'vers la gauche' },
    center: { ar: 'في منتصف الجسم', en: 'at the body midline', fr: 'sur la ligne médiane' },
    right: { ar: 'ناحية اليمين', en: 'toward the right', fr: 'vers la droite' },
  };

  return {
    ar: `${name} ${V[vBand].ar} ${H[hBand].ar}.`,
    en: `${name} is ${V[vBand].en} ${H[hBand].en}.`,
    fr: `${name} se trouve ${V[vBand].fr} ${H[hBand].fr}.`,
  };
}

/** يحدّد المنطقة/البنية الأقرب لنقطة ألم اختارها المستخدم. */
export function nearestToPoint(
  point: Coords,
  candidates: CatalogEntry[],
  direction: Direction = 'near',
): CatalogEntry | null {
  const pool = candidates.filter((c) => c.coords && c.coords.view === point.view);
  if (!pool.length) return null;
  return candidatesInDirection(point, pool, direction)[0] ?? null;
}

/** يصف موقع نقطة ألم بالنسبة لحدود الخريطة (وصف إرشادي بحت). */
export function describePoint(point: Coords, _lang: Lang): LocalizedText {
  const vBand = point.y < 33 ? 'upper' : point.y > 66 ? 'lower' : 'middle';
  const hBand = point.x < 42 ? 'left' : point.x > 58 ? 'right' : 'center';
  const V: Record<string, LocalizedText> = {
    upper: { ar: 'أعلى', en: 'upper', fr: 'supérieure' },
    middle: { ar: 'منتصف', en: 'middle', fr: 'médiane' },
    lower: { ar: 'أسفل', en: 'lower', fr: 'inférieure' },
  };
  const H: Record<string, LocalizedText> = {
    left: { ar: 'ناحية اليسار', en: 'left side', fr: 'côté gauche' },
    center: { ar: 'في المنتصف', en: 'center', fr: 'centre' },
    right: { ar: 'ناحية اليمين', en: 'right side', fr: 'côté droit' },
  };
  const view = point.view === 'back' ? { ar: 'الظهر', en: 'the back', fr: 'le dos' } : { ar: 'الأمام', en: 'the front', fr: 'le devant' };
  return {
    ar: `النقطة في ${V[vBand].ar} ${view.ar} ${H[hBand].ar}.`,
    en: `The point is in the ${V[vBand].en} ${view.en}, ${H[hBand].en}.`,
    fr: `Le point se situe dans la partie ${V[vBand].fr} ${view.fr}, ${H[hBand].fr}.`,
  };
}

export { DIRECTION_LABELS };
