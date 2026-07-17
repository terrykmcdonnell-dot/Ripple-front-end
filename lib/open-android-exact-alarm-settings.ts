import Constants from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';

/** Opens Android Alarms & reminders (exact-alarm) settings for this app. */
export async function openAndroidExactAlarmPermissionSettings(): Promise<void> {
  if (Platform.OS !== 'android' || (Platform.Version as number) < 31) {
    return;
  }
  const pkg = Constants.expoConfig?.android?.package?.trim() || 'com.terrykm.ripplealarmapp';
  if (!pkg) {
    return;
  }
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.REQUEST_SCHEDULE_EXACT_ALARM, {
      data: `package:${pkg}`,
    });
  } catch {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, {
      data: `package:${pkg}`,
    });
  }
}
