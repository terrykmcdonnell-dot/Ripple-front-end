import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';

import { notifyAuthWarning } from '@/lib/auth-notify';
import { fetchIsSubscriberFresh, limitsApply } from '@/lib/subscription-access';

/**
 * Free-tier cap: without Ripple Pro, a single alarm rings this many times before the next
 * occurrence is blocked at ring time (the alarm stays set up and enabled). Device-local only —
 * this is a soft usage nudge, not a security boundary, so it does not need to sync across devices.
 */
export const FREE_TIER_MAX_RINGS_PER_ALARM = 2;

/** Encouraging copy when the free ring cap blocks the next occurrence. */
export function freeTierRingLimitToastMessage(): string {
  return `This alarm has rung ${FREE_TIER_MAX_RINGS_PER_ALARM} times on the free plan — subscribe to Ripple Pro to keep it ringing.`;
}

/** Paywall banner when opened from a blocked ring. */
export function freeTierRingLimitPaywallBanner(): string {
  return `Your free alarm has rung ${FREE_TIER_MAX_RINGS_PER_ALARM} times — subscribe to keep it ringing.`;
}

export function openFreeTierRingLimitPaywall(): void {
  notifyAuthWarning('Subscribe to keep ringing', freeTierRingLimitToastMessage());
  router.replace('/paywall?ringLimit=1');
}

/** True when a free user has used all included rings and the next occurrence must not fire. */
export async function isFreeTierRingDeliveryBlocked(alarmId: number): Promise<boolean> {
  const isSubscriber = await fetchIsSubscriberFresh();
  if (!limitsApply(isSubscriber)) {
    return false;
  }
  return isFreeRingLimitReached(alarmId);
}

const RING_COUNT_KEY = 'ripple_alarm_free_ring_count_v1';

type RingCountMap = Record<string, number>;

async function loadRingCountMap(): Promise<RingCountMap> {
  try {
    const raw = await AsyncStorage.getItem(RING_COUNT_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : {};
    return parsed && typeof parsed === 'object' ? (parsed as RingCountMap) : {};
  } catch {
    return {};
  }
}

async function saveRingCountMap(map: RingCountMap): Promise<void> {
  try {
    await AsyncStorage.setItem(RING_COUNT_KEY, JSON.stringify(map));
  } catch {
    /* ignore storage errors */
  }
}

/** Rings counted so far for this alarm while on the free tier. */
export async function getFreeRingCount(alarmId: number): Promise<number> {
  const map = await loadRingCountMap();
  return map[String(alarmId)] ?? 0;
}

/** True once this alarm has rung `FREE_TIER_MAX_RINGS_PER_ALARM` times as a free user. */
export async function isFreeRingLimitReached(alarmId: number): Promise<boolean> {
  return (await getFreeRingCount(alarmId)) >= FREE_TIER_MAX_RINGS_PER_ALARM;
}

/** IDs of every alarm that has hit the free ring limit (scheduling skips these until Pro). */
export async function getFreeRingLockedAlarmIds(): Promise<Set<number>> {
  const map = await loadRingCountMap();
  const ids = new Set<number>();
  for (const [key, count] of Object.entries(map)) {
    if (count >= FREE_TIER_MAX_RINGS_PER_ALARM) {
      const id = Number(key);
      if (Number.isFinite(id)) {
        ids.add(id);
      }
    }
  }
  return ids;
}

/**
 * Increments the ring counter for one alarm occurrence. Callers must only invoke this once
 * per delivered occurrence (the fire-scheduler dedupes via its delivered-occurrence map).
 */
export async function incrementFreeRingCount(
  alarmId: number,
): Promise<{ count: number; justReachedLimit: boolean }> {
  const map = await loadRingCountMap();
  const key = String(alarmId);
  const previous = map[key] ?? 0;
  const count = previous + 1;
  map[key] = count;
  await saveRingCountMap(map);
  return {
    count,
    justReachedLimit: previous < FREE_TIER_MAX_RINGS_PER_ALARM && count >= FREE_TIER_MAX_RINGS_PER_ALARM,
  };
}

/** Drops the stored ring count for a deleted alarm so a future alarm never reuses stale state. */
export async function clearFreeRingCount(alarmId: number): Promise<void> {
  const map = await loadRingCountMap();
  if (map[String(alarmId)] === undefined) {
    return;
  }
  delete map[String(alarmId)];
  await saveRingCountMap(map);
}
