export const HISTORY_LIMIT: number;

export function sortByRecent<T extends { id: string; createdAtIso?: string; partId: string; intensity: number; painType: string; duration: string; createdAt: string }>(records: T[]): T[];
export function capHistory<T extends { id: string; partId: string; intensity: number; painType: string; duration: string; createdAt: string }>(records: T[], limit?: number): T[];
export function prependRecord<T extends { id: string; partId: string; intensity: number; painType: string; duration: string; createdAt: string }>(records: T[], record: T, limit?: number): T[];
export function mergeHistories<T extends { id: string; partId: string; intensity: number; painType: string; duration: string; createdAt: string; createdAtIso?: string }>(current: T[], incoming: T[], limit?: number): T[];

export type HistorySummary = {
  count: number;
  average: number;
  urgentCount: number;
  recentCount: number;
  topArea: string | null;
  topAreaCount: number;
};

export function summarizeHistory(
  records: Array<{ id: string; partId: string; intensity: number; painType: string; duration: string; createdAt: string; urgent?: boolean; createdAtIso?: string; areaLabel?: string }>,
  now?: number
): HistorySummary;
