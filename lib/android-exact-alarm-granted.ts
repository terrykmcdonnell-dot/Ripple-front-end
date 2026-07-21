import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type RippleAlarmPrefsModule = {
  canScheduleExactAlarmsAsync?: () => Promise<boolean>;
};

async function readCanScheduleExactAlarms(): Promise<boolean | null> {
  if (Platform.OS !== 'android') {
    return null;
  }
  try {
    const mod = requireOptionalNativeModule<RippleAlarmPrefsModule>('RippleAlarmPrefs');
    if (mod?.canScheduleExactAlarmsAsync) {
      return await mod.canScheduleExactAlarmsAsync();
    }
  } catch {
    /* native module unavailable */
  }
  return null;
}

export type AndroidExactAlarmStatus = 'allowed' | 'denied' | 'unknown' | 'not_applicable';

/** Android exact-alarm permission state for PostHog analytics (not UI). */
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
