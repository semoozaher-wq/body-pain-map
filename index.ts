// types/index.ts

export type Screen = 'welcome' | 'body' | 'details' | 'results' | 'history';
export type AppGender = 'male' | 'female';
export type BodyView = 'front' | 'back';

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
  intensity: number;
  painType: string;
  duration: string;
  createdAt: string;
  createdAtIso?: string;
  note?: string;
  urgent?: boolean;
  afterIntensity?: number;
  selfCareGuide?: string;
  selfCarePointId?: string;
};
