// services/medical/medlinePlusConnect.ts
// ربط الحالات/الأدوية بمحتوى موثوق عبر MedlinePlus Connect (NLM).
// خدمة عامة بدون مفتاح — https://medlineplus.gov/connect/
// ملاحظة: MedlinePlus يسمح بالربط والعرض، ولا يسمح بنسخ الصفحات كاملة.

const CONNECT_BASE = 'https://connect.medlineplus.gov/application';
const DEFAULT_TIMEOUT = 9000;

// أنظمة الأكواد المدعومة (OID).
export const CODE_SYSTEMS = {
  ICD10CM: '2.16.840.1.113883.6.90',
  SNOMEDCT: '2.16.840.1.113883.6.96',
  ICD9CM: '2.16.840.1.113883.6.103',
} as const;

export type CodeSystem = keyof typeof CODE_SYSTEMS;
export type ConnectLanguage = 'en' | 'es';

export interface MedlinePlusLink {
  title: string;
  url: string;
  source?: string;
}

export interface MedlinePlusResponse {
  title?: string;
  summary?: string;
  links: MedlinePlusLink[];
}

function pickLink(entry: Record<string, unknown>): MedlinePlusLink | null {
  const title = (entry.title as string) ?? '';
  const link = (entry.link as string) ?? '';
  if (!title || !link) return null;
  return { title, url: link, source: (entry.organization as string) ?? undefined };
}

/**
 * جلب محتوى MedlinePlus المرتبط بكود سريري (ICD-10 / SNOMED / ICD-9).
 * ملاحظة: MedlinePlus Connect يدعم الإنجليزية والإسبانية فقط في واجهته؛
 * نعرض المحتوى كما هو مع رابط المصدر الأصلي.
 */
export async function lookupByCode(
  code: string,
  system: CodeSystem = 'ICD10CM',
  displayName?: string,
  language: ConnectLanguage = 'en'
): Promise<MedlinePlusResponse | null> {
  const c = code.trim();
  if (!c) return null;

  const params = new URLSearchParams({
    'mainSearchCriteria.v.c': c,
    'mainSearchCriteria.v.cs': CODE_SYSTEMS[system],
    'informationRecipient.languageCode.c': language,
    knowledgeResponseType: 'application/json',
  });
  if (displayName) params.set('mainSearchCriteria.v.dn', displayName);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
  try {
    const response = await fetch(`${CONNECT_BASE}?${params.toString()}`, {
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      feed?: { title?: { _value?: string }; entry?: Record<string, unknown>[] };
      title?: { _value?: string };
      entry?: Record<string, unknown>[];
    };

    const feed = data.feed ?? data;
    const entries = (feed.entry ?? []) as Record<string, unknown>[];
    const links = entries.map(pickLink).filter((x): x is MedlinePlusLink => x !== null);

    return {
      title: feed.title?._value,
      links,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
