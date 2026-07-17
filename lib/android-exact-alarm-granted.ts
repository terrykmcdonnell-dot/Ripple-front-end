import { requireOptionalNativeModule } from 'expo-modules-core';
import { NativeModules, Platform } from 'react-native';

type RippleAlarmPrefsExactAlarmModule = {
  canScheduleExactAlarmsAsync?: () => Promise<boolean>;
};

async function readCanScheduleExactAlarms(): Promise<boolean | null> {
  try {
    const mod = requireOptionalNativeModule<RippleAlarmPrefsExactAlarmModule>('RippleAlarmPrefs');
    if (typeof mod?.canScheduleExactAlarmsAsync === 'function') {
      return await mod.canScheduleExactAlarmsAsync();
    }
  } catch {
    /* try legacy bridge */
  }

  try {
    const legacy = NativeModules.RippleAlarmPrefs as RippleAlarmPrefsExactAlarmModule | undefined;
    if (typeof legacy?.canScheduleExactAlarmsAsync === 'function') {
      return await legacy.canScheduleExactAlarmsAsync();
    }
  } catch {
    /* fall through */
  }

  return null;
}

export type AndroidExactAlarmStatus = 'allowed' | 'denied' | 'unknown' | 'not_applicable';

/** Android exact-alarm permission state for analytics and UI. */
export async function getAndroidExactAlarmStatus(): Promise<AndroidExactAlarmStatus> {
  if (Platform.OS !== 'android') {
    return 'not_applicable';
  }
  if ((Platform.Version as number) < 31) {
    return 'not_applicable';
  }
  const granted = await readCanScheduleExactAlarms();
  if (granted === null) {
    return 'unknown';
  }
  return granted ? 'allowed' : 'denied';
}

/** Android 12+ (API 31): whether the user allowed exact alarm scheduling for this app. */
export async function isAndroidExactAlarmGranted(): Promise<boolean> {
  if (Platform.OS !== 'android' || (Platform.Version as number) < 31) {
    return true;
  }
  const granted = await readCanScheduleExactAlarms();
  // Native method ships with the app binary — assume granted if unavailable (e.g. old dev build).
  return granted ?? true;
}

export function needsAndroidExactAlarmPermissionCheck(): boolean {
  return Platform.OS === 'android' && (Platform.Version as number) >= 31;
}
