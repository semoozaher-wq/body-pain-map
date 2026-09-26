// services/medical/openFda.ts
// ملصقات الأدوية والأحداث الجانبية عبر openFDA (U.S. FDA).
// خدمة عامة بدون مفتاح — https://open.fda.gov/
// ملاحظة: النصوص إنجليزية في المصدر؛ نعرضها كما هي مع تنبيه إرشادي.

const OPENFDA_BASE = 'https://api.fda.gov';
const DEFAULT_TIMEOUT = 9000;

export interface DrugLabel {
  brandName?: string;
  genericName?: string;
  manufacturer?: string;
  indications?: string;
  warnings?: string;
  adverseReactions?: string;
  dosage?: string;
  interactions?: string;
  contraindications?: string;
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

function firstText(value: unknown): string | undefined {
  if (Array.isArray(value) && value.length > 0 && typeof value[0] === 'string') {
    return value[0];
  }
  if (typeof value === 'string') return value;
  return undefined;
}

/**
 * جلب ملصق دواء من openFDA بالاسم (تجاري أو فعّال).
 * يرجّع أول نتيجة مطابقة مع أهم الحقول.
 */
export async function getDrugLabel(name: string): Promise<DrugLabel | null> {
  const q = name.trim();
  if (!q) return null;

  const search = `openfda.brand_name:"${q}"+OR+openfda.generic_name:"${q}"`;
  const url = `${OPENFDA_BASE}/drug/label.json?search=${encodeURIComponent(search)}&limit=1`;

  const data = await fetchJson<{ results?: Record<string, unknown>[] }>(url);
  const result = data?.results?.[0];
  if (!result) return null;

  const openfda = (result.openfda ?? {}) as Record<string, unknown>;

  return {
    brandName: firstText(openfda.brand_name),
    genericName: firstText(openfda.generic_name),
    manufacturer: firstText(openfda.manufacturer_name),
    indications: firstText(result.indications_and_usage),
    warnings: firstText(result.warnings) ?? firstText(result.boxed_warning),
    adverseReactions: firstText(result.adverse_reactions),
    dosage: firstText(result.dosage_and_administration),
    interactions: firstText(result.drug_interactions),
    contraindications: firstText(result.contraindications),
  };
}

/**
 * أكثر الأحداث الجانبية المُبلَّغ عنها لدواء (مبسّطة من openFDA FAERS).
 * ملاحظة: التبليغ لا يعني بالضرورة سببية مؤكدة.
 */
export async function getAdverseEvents(name: string, limit = 5): Promise<{ term: string; count: number }[]> {
  const q = name.trim();
  if (!q) return [];

  const search = `patient.drug.medicinalproduct:"${q}"`;
  const url = `${OPENFDA_BASE}/drug/event.json?search=${encodeURIComponent(search)}&count=patient.reaction.reactionmeddrapt.exact&limit=${limit}`;

  const data = await fetchJson<{ results?: { term?: string; count?: number }[] }>(url);
  return (data?.results ?? [])
    .filter((r) => r.term)
    .map((r) => ({ term: r.term as string, count: r.count ?? 0 }));
}
