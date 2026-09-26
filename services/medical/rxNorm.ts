// services/medical/rxNorm.ts
// توحيد أسماء الأدوية والتفاعلات الدوائية عبر RxNorm / RxNav (NLM).
// خدمة عامة بدون مفتاح — https://rxnav.nlm.nih.gov/
// ملاحظة: النتائج مرجعية تعليمية فقط، وليست توصية دوائية.

const RXNAV_BASE = 'https://rxnav.nlm.nih.gov/REST';
const DEFAULT_TIMEOUT = 8000;

export interface DrugConcept {
  rxcui: string;
  name: string;
  synonym?: string;
  tty?: string; // نوع المصطلح (Ingredient, Brand Name, ...)
}

export interface DrugInteraction {
  severity?: string;
  description: string;
  drugs: string[];
}

async function fetchJson<T>(url: string, timeout = DEFAULT_TIMEOUT): Promise<T | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * بحث عن دواء بالاسم (تقريبي) وإرجاع قائمة المفاهيم (RxCUI).
 * يدعم الأسماء التجارية والمواد الفعالة.
 */
export async function searchDrugByName(name: string): Promise<DrugConcept[]> {
  const q = name.trim();
  if (!q) return [];

  const url = `${RXNAV_BASE}/drugs.json?name=${encodeURIComponent(q)}`;
  const data = await fetchJson<{
    drugGroup?: {
      conceptGroup?: {
        tty?: string;
        conceptProperties?: { rxcui: string; name: string; synonym?: string }[];
      }[];
    };
  }>(url);

  const groups = data?.drugGroup?.conceptGroup ?? [];
  const results: DrugConcept[] = [];
  for (const group of groups) {
    for (const concept of group.conceptProperties ?? []) {
      results.push({
        rxcui: concept.rxcui,
        name: concept.name,
        synonym: concept.synonym,
        tty: group.tty,
      });
    }
  }
  return results;
}

/** جلب تفاصيل مفهوم دوائي عبر RxCUI. */
export async function getDrugByRxcui(rxcui: string): Promise<DrugConcept | null> {
  const url = `${RXNAV_BASE}/rxcui/${encodeURIComponent(rxcui)}/properties.json`;
  const data = await fetchJson<{
    properties?: { rxcui: string; name: string; synonym?: string; tty?: string };
  }>(url);
  const p = data?.properties;
  if (!p) return null;
  return { rxcui: p.rxcui, name: p.name, synonym: p.synonym, tty: p.tty };
}

/**
 * التفاعلات الدوائية المحتملة بين مجموعة من الأدوية (RxCUIs).
 * تحذير: هذه قائمة أولية للمراجعة فقط، ولا تغني عن الصيدلي أو الطبيب.
 */
export async function getDrugInteractions(rxcuis: string[]): Promise<DrugInteraction[]> {
  const list = rxcuis.filter(Boolean).join('+');
  if (!list) return [];

  const url = `${RXNAV_BASE}/interaction/list.json?rxcuis=${encodeURIComponent(list)}`;
  const data = await fetchJson<{
    fullInteractionTypeGroup?: {
      fullInteractionType?: {
        interactionPair?: {
          severity?: string;
          description?: string;
          interactionConcept?: { minConceptItem?: { name?: string } }[];
        }[];
      }[];
    }[];
  }>(url);

  const results: DrugInteraction[] = [];
  const groups = data?.fullInteractionTypeGroup ?? [];
  for (const group of groups) {
    for (const type of group.fullInteractionType ?? []) {
      for (const pair of type.interactionPair ?? []) {
        results.push({
          severity: pair.severity,
          description: pair.description ?? '',
          drugs: (pair.interactionConcept ?? [])
            .map((c) => c.minConceptItem?.name ?? '')
            .filter(Boolean),
        });
      }
    }
  }
  return results;
}
