import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

type RippleAlarmPrefsModule = {
  setDefaultSnoozeMinutes?: (minutes: number) => void;
  consumePendingActionsAsync?: () => Promise<string>;
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
