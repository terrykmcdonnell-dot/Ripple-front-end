import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type RippleAlarmPrefsModule = {
  setDefaultSnoozeMinutes?: (minutes: number) => void;
  consumePendingActionsAsync?: () => Promise<string>;
  getDeliveredMapAsync?: () => Promise<string>;
  setAlarmFireDelivered?: (alarmId: number, fireAtMs: number) => void;
  setEnabledAlarmIds?: (ids: number[]) => void;
  startAlarmSound?: (
    soundName: string,
    alarmTitle: string,
    alarmBody: string,
    alarmIdentifier: string,
    alarmPayload: string,
    presentationMode: string,
  ) => void;
  stopAlarmSound?: () => void;
  cancelNativeSnoozeAlarm?: () => void;
};

type StartNativeAlarmSoundOptions = {
  soundName: string;
  alarmTitle: string;
  alarmBody: string;
  alarmIdentifier: string;
  alarmPayload: string;
  presentationMode?: 'background' | 'lockscreen';
};

let nativeAlarmSoundActive = false;

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

/** Mirrors enabled alarm ids to native prefs for background / lock-screen delivery checks. */
export function syncEnabledAlarmIdsToNative(alarmIds: number[]): void {
  if (Platform.OS !== 'android') {
    return;
  }
  try {
    const mod = requireOptionalNativeModule<RippleAlarmPrefsModule>('RippleAlarmPrefs');
    mod?.setEnabledAlarmIds?.(alarmIds);
  } catch {
    /* native module unavailable */
  }
}

export function startNativeAlarmSound(options: StartNativeAlarmSoundOptions): boolean {
  if (Platform.OS !== 'android') {
    return false;
  }
  try {
    const mod = requireOptionalNativeModule<RippleAlarmPrefsModule>('RippleAlarmPrefs');
    if (!mod?.startAlarmSound) {
      return false;
    }
    mod.startAlarmSound(
      options.soundName,
      options.alarmTitle,
      options.alarmBody,
      options.alarmIdentifier,
      options.alarmPayload,
      options.presentationMode ?? 'background',
    );
    nativeAlarmSoundActive = true;
    return true;
  } catch {
    return false;
  }
}

export function hasNativeAlarmSoundActive(): boolean {
  return Platform.OS === 'android' && nativeAlarmSoundActive;
}

export function stopNativeAlarmSound(): void {
  if (Platform.OS !== 'android') {
    return;
  }
  nativeAlarmSoundActive = false;
  try {
    const mod = requireOptionalNativeModule<RippleAlarmPrefsModule>('RippleAlarmPrefs');
    mod?.stopAlarmSound?.();
  } catch {
    /* native module unavailable */
  }
}

export function cancelNativeSnoozeAlarm(): void {
  if (Platform.OS !== 'android') {
    return;
  }
  try {
    const mod = requireOptionalNativeModule<RippleAlarmPrefsModule>('RippleAlarmPrefs');
    mod?.cancelNativeSnoozeAlarm?.();
  } catch {
    /* native module unavailable */
  }
}
