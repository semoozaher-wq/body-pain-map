export type ImageQualityIssue = 'too_small' | 'blurry' | 'too_dark' | 'too_bright';

export type ImageQualityReport = {
  ok: boolean;
  issues: ImageQualityIssue[];
  laplacianVariance: number;
  brightness: number;
  messageAr: string;
};

export type FollowUpQuestion = {
  id: string;
  questionAr: string;
  type: 'choice' | 'number';
  options?: string[];
  required?: boolean;
};

export type Urgency = 'self_care' | 'routine' | 'soon' | 'urgent' | 'emergency';

export type TriageInput = {
  redFlags?: string[];
  fever?: boolean;
  spreading?: boolean;
  blister?: boolean;
  breathingDifficulty?: boolean;
  severity?: number;
  durationDays?: number;
  groupKey?: string;
  areaId?: string;
  skinContext?: boolean;
};

export type TriageResult = {
  urgency: Urgency;
  escalation: boolean;
  reasonsAr: string[];
  specialty: string;
  specialtyKey: string;
};

export type Specialty = { key: string; labelAr: string; rationaleAr: string };

export type MergedPossibility = TriageResult & {
  possibilities: string[];
  labelAr: string;
};

export const BLUR_VARIANCE_THRESHOLD: number;
export const MIN_DIMENSION: number;

export function toGrayscale(pixels: ArrayLike<number>, width: number, height: number): Float64Array;
export function laplacianVariance(gray: ArrayLike<number>, width: number, height: number): number;
export function meanBrightness(gray: ArrayLike<number>): number;
export function assessImageQuality(pixels: ArrayLike<number>, width: number, height: number): ImageQualityReport;
export function buildFollowUpQuestions(context?: { groupKey?: string; areaId?: string }): FollowUpQuestion[];
export function runRuleBasedTriage(input?: TriageInput): TriageResult;
export function mapSpecialty(groupKey?: string, options?: { skinContext?: boolean }): Specialty;
export function mergeWithModelPossibilities(triage: TriageResult, possibilities: string[]): MergedPossibility;
