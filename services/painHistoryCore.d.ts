export const HISTORY_LIMIT: number;

export function sortByRecent<T extends { createdAtIso?: string }>(records: T[]): T[];
export function capHistory<T>(records: T[], limit?: number): T[];
export function prependRecord<T>(records: T[], record: T, limit?: number): T[];
export function mergeHistories<T extends { id?: string }>(current: T[], incoming: T[], limit?: number): T[];

export type HistorySummary = {
  count: number;
  average: number;
  urgentCount: number;
  recentCount: number;
  topArea: string | null;
  topAreaCount: number;
};

export function summarizeHistory(
  records: Array<{ intensity?: number; urgent?: boolean; createdAtIso?: string; partId?: string; areaLabel?: string }>,
  now?: number
): HistorySummary;
