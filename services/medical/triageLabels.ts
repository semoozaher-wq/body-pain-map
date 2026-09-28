// services/medical/triageLabels.ts
// جسر لغوي موحّد لحالات الفرز (TriageStatus) بثلاث لغات: عربي / إنجليزي / فرنسي.
//
// السبب: كانت الشاشات تكرّر تسميات الحالة (روتيني/شدة مرتفعة/عاجل) نصيًّا في
// أكثر من موضع. هذا الملف نقطة واحدة للتسميات، مربوطة بالمصدر الوحيد للحقيقة
// `services/triageCore.js`، حتى لا تختلف الصياغة بين الشاشات أو اللغات.

import type { TriageStatus } from '../triageCore';
import type { Language } from '../i18n';

type LabelMap = Record<Language, string>;

/** تسميات حالة الفرز بثلاث لغات (نفس ترتيب TRIAGE_STATUSES في triageCore). */
export const TRIAGE_STATUS_LABELS: Record<TriageStatus, LabelMap> = {
  routine: {
    ar: 'روتيني',
    en: 'Routine',
    fr: 'Routine',
  },
  high_reported_intensity: {
    ar: 'شدة مرتفعة مُبلَّغ عنها',
    en: 'High reported intensity',
    fr: 'Intensité élevée signalée',
  },
  urgent: {
    ar: 'عاجل',
    en: 'Urgent',
    fr: 'Urgent',
  },
};

/** تسمية الحالة بلغة المستخدم مع السقوط للعربية عند غياب الترجمة. */
export function triageStatusLabel(language: Language, status: TriageStatus): string {
  const entry = TRIAGE_STATUS_LABELS[status];
  if (!entry) return String(status);
  return entry[language] ?? entry.ar;
}

/** هل الحالة تتطلّب تدخّلًا عاجلًا؟ (مصدر واحد للقرار في الواجهة). */
export function triageStatusIsUrgent(status: TriageStatus): boolean {
  return status === 'urgent';
}

/** هل الحالة «شدة مرتفعة» (تنبيه لا طوارئ)؟ */
export function triageStatusIsHighIntensity(status: TriageStatus): boolean {
  return status === 'high_reported_intensity';
}
