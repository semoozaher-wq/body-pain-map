// services/triage.d.ts — يُعيد تصدير الأنواع من المصدر الوحيد للحقيقة.
export type { TriageStatus } from './triageCore';
export {
  getTriageStatus,
  isTriageStatus,
  TRIAGE_STATUSES,
  HIGH_INTENSITY_THRESHOLD,
} from './triageCore';
