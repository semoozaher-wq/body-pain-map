// types/index.ts

export type Screen = 'welcome' | 'body' | 'details' | 'results' | 'history' | 'assistant' | 'healthInfo';
export type AppGender = 'male' | 'female';
export type BodyView = 'front' | 'back' | 'organs';

export type Muscle = {
  id: string;
  partNumber: number;
  labelAr: string;
  group: string;
  groupLabelAr: string;
  locationAr: string;
  commonCauses: string[];
  warning?: string | null;
  recommendation?: string | null;
  medicalSafety: string;
};

export type Group = {
  labelAr: string;
  defaultWarning?: string | null;
  defaultRecommendation: string;
};

export type AnatomyData = {
  groups: Record<string, Group>;
  muscles: Record<string, Muscle>;
};

export type Checkup = {
  id: string;
  partId: string;
  areaLabel?: string;
  intensity: number;
  painType: string;
  duration: string;
  createdAt: string;
  createdAtIso?: string;
  note?: string;
  medication?: string;
  triggers?: string;
  sleepHours?: number;
  activity?: string;
  urgent?: boolean;
  triageStatus?: 'routine' | 'high_reported_intensity' | 'urgent';
  redFlags?: string[];
  symptoms?: string[];
  afterIntensity?: number;
  selfCareGuide?: string;
  selfCarePointId?: string;
};

/** جهة اتصال طبية محفوظة محليًّا (لا تُرسل لخادم). */
export type MedicalContact = {
  id: string;
  name: string;
  phone: string;
  /** الصفة: طبيب / قريب … اختياري. */
  relation: string;
  /** جهة الاتصال الأساسية التي تظهر في لوحة الطوارئ. */
  isPrimary: boolean;
};

/**
 * بلد في جدول أرقام الطوارئ.
 * ملاحظة: كل الأرقام قيم افتراضية تحتاج تأكيدًا — راجع data/emergencyNumbers.json
 * وservices/emergencyCore.js.
 */
export type EmergencyCountry = {
  code: string;
  name: { ar: string; en: string; fr: string };
  needsConfirmation: boolean;
  numbers: Array<{ key: string; number: string }>;
};
