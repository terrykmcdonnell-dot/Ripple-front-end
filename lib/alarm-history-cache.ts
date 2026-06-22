import type { AlarmHistoryApiRow } from '@/lib/alarm-history-api';

type HistoryCache = {
  userId: number;
  rows: AlarmHistoryApiRow[];
};

let cache: HistoryCache | null = null;

/** Last fetched history rows for instant tab revisits. */
export function getAlarmHistoryCache(userId?: number): AlarmHistoryApiRow[] | null {
  if (!cache) {
    return null;
  }
  if (userId != null && cache.userId !== userId) {
    return null;
  }
  return cache.rows;
}

export function setAlarmHistoryCache(userId: number, rows: AlarmHistoryApiRow[]): void {
  cache = { userId, rows };
}

export function invalidateAlarmHistoryCache(): void {
  cache = null;
}
