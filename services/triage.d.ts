export type TriageStatus = 'routine' | 'high_reported_intensity' | 'urgent';
export function getTriageStatus(intensity: number, redFlags?: string[]): TriageStatus;
