import type { AlarmListItem } from '@/lib/alarm-format';

type AlarmListCache = {
  userId: number;
  rows: AlarmListItem[];
};

let cache: AlarmListCache | null = null;

/**
 * Last fetched alarm rows for instant screen revisits.
 *
 * Without this, every fresh mount of the Alarms screen (e.g. `router.replace('/alarm')` after
 * saving a new alarm, editing one, or coming back from the paywall) starts from an empty list
 * and `initialLoad = true`, flashing the full-screen spinner and an empty state for a moment
 * before the re-fetch resolves — even though the previous instance already had the data a moment
 * earlier. Seeding state from this cache removes that flicker; a silent background refresh still
 * runs on every focus to catch any real changes.
 */
export function getAlarmListCache(userId?: number): AlarmListItem[] | null {
  if (!cache) {
    return null;
  }
  if (userId != null && cache.userId !== userId) {
    return null;
  }
  return cache.rows;
}

export function setAlarmListCache(userId: number, rows: AlarmListItem[]): void {
  cache = { userId, rows };
}

export function invalidateAlarmListCache(): void {
  cache = null;
}
