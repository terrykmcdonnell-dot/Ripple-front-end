import AsyncStorage from '@react-native-async-storage/async-storage';

import { fetchAlarms } from '@/lib/alarm-api';

const STORAGE_KEY = 'ripple_template_pack_alarm_ids_v1';

export async function getAllPackAlarmIds(): Promise<Record<string, number[]>> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return {};
    }
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }
    const out: Record<string, number[]> = {};
    for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
      if (Array.isArray(v) && v.every((x) => typeof x === 'number')) {
        out[k] = v as number[];
      }
    }
    return out;
  } catch {
    return {};
  }
}

export async function setPackAlarmIds(packId: string, ids: number[]): Promise<void> {
  const all = await getAllPackAlarmIds();
  if (ids.length === 0) {
    delete all[packId];
  } else {
    all[packId] = ids;
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

export async function isPackInstalled(packId: string): Promise<boolean> {
  const ids = (await getAllPackAlarmIds())[packId];
  return Array.isArray(ids) && ids.length > 0;
}

/** Drops stored ids that no longer exist (e.g. user deleted alarms on the Alarms screen). */
export async function reconcilePackAlarmIdsWithServer(userId: number): Promise<Record<string, number[]>> {
  const raw = await getAllPackAlarmIds();
  const rows = await fetchAlarms(userId);
  const existing = new Set(rows.map((r) => r.id));
  const next: Record<string, number[]> = {};
  for (const [k, ids] of Object.entries(raw)) {
    const filtered = ids.filter((id) => existing.has(id));
    if (filtered.length > 0) {
      next[k] = filtered;
    }
  }
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}
