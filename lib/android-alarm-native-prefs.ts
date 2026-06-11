import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type RippleAlarmPrefsModule = {
  setDefaultSnoozeMinutes?: (minutes: number) => void;
  consumePendingActionsAsync?: () => Promise<string>;
  getDeliveredMapAsync?: () => Promise<string>;
  setAlarmFireDelivered?: (alarmId: number, fireAtMs: number) => void;
};

export function syncDefaultSnoozeMinutesToNative(minutes: number): void {
  if (Platform.OS !== 'android') {
    return;
  }
  try {
    const mod = requireOptionalNativeModule<RippleAlarmPrefsModule>('RippleAlarmPrefs');
    mod?.setDefaultSnoozeMinutes?.(Math.round(minutes));
  } catch {
    /* native module unavailable */
  }
}

export async function consumeNativePendingAlarmActionsRaw(): Promise<string> {
  if (Platform.OS !== 'android') {
    return '';
  }
  try {
    const mod = requireOptionalNativeModule<RippleAlarmPrefsModule>('RippleAlarmPrefs');
    if (mod?.consumePendingActionsAsync) {
      return (await mod.consumePendingActionsAsync()) || '';
    }
  } catch {
    /* fall through */
  }
  return '';
}

export async function getNativeAlarmFireDeliveredMap(): Promise<Record<string, number>> {
  if (Platform.OS !== 'android') {
    return {};
  }
  try {
    const mod = requireOptionalNativeModule<RippleAlarmPrefsModule>('RippleAlarmPrefs');
    const raw = mod?.getDeliveredMapAsync ? await mod.getDeliveredMapAsync() : '{}';
    const parsed = JSON.parse(raw || '{}') as Record<string, unknown>;
    const map: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const n = typeof value === 'number' ? value : Number(value);
      if (Number.isFinite(n)) {
        map[key] = n;
      }
    }
    return map;
  } catch {
    return {};
  }
}

export function syncNativeAlarmFireDelivered(alarmId: number, fireAtMs: number): void {
  if (Platform.OS !== 'android') {
    return;
  }
  try {
    const mod = requireOptionalNativeModule<RippleAlarmPrefsModule>('RippleAlarmPrefs');
    mod?.setAlarmFireDelivered?.(alarmId, fireAtMs);
  } catch {
    /* native module unavailable */
  }
}
