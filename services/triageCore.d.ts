export type TriageStatus = 'routine' | 'high_reported_intensity' | 'urgent';

export const TRIAGE_STATUSES: TriageStatus[];
export const HIGH_INTENSITY_THRESHOLD: number;

export function getTriageStatus(intensity: number, redFlags?: string[]): TriageStatus;
export function isTriageStatus(value: unknown): value is TriageStatus;
