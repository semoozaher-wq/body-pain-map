export type LocalizedText = { ar: string; en: string; fr: string };

export type EmergencyNumberEntry = {
  key: string;
  number: string;
  label: LocalizedText;
  telUrl: string;
};

export type EmergencyCountry = {
  code: string;
  name: LocalizedText;
  needsConfirmation: boolean;
  numbers: Array<{ key: string; number: string }>;
};

export type MedicalContactInput = {
  id?: string;
  name: string;
  phone: string;
  relation?: string;
  isPrimary?: boolean;
};

export type MedicalContact = {
  id: string;
  name: string;
  phone: string;
  relation: string;
  isPrimary: boolean;
};

export const COUNTRIES: EmergencyCountry[];
export const DEFAULT_COUNTRY_CODE: string;
export const COUNTRY_STORAGE_KEY: string;
export const CONTACTS_STORAGE_KEY: string;

export function getCountry(code?: string): EmergencyCountry | null;
export function getCountryName(code: string, language: 'ar' | 'en' | 'fr'): string;
export function needsConfirmation(code: string): boolean;
export function getEmergencyNumbers(code?: string): EmergencyNumberEntry[];
export function numberKeyLabel(key: string): LocalizedText;
export function sanitizePhone(value: string): string;
export function isValidPhone(value: string): boolean;
export function buildTelUrl(value: string): string;
export function sanitizeContact(
  contact: MedicalContactInput | Partial<MedicalContact>
): { ok: boolean; contact?: MedicalContact; error?: string };
export function sanitizeContactList(list: unknown): MedicalContact[];
