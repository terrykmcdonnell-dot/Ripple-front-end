import Constants from 'expo-constants';
import { Platform } from 'react-native';

import * as IntentLauncher from 'expo-intent-launcher';

/** Android 14+ can restrict full-screen intents; opens the system page to allow them for this app. */
export async function openAndroidFullScreenAlarmPermissionSettings(): Promise<void> {
  if (Platform.OS !== 'android' || Platform.Version < 34) {
    return;
  }
  const pkg = Constants.expoConfig?.android?.package?.trim() || 'com.terrykm.ripplealarm';
  if (!pkg) {
    return;
  }
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.MANAGE_APP_USE_FULL_SCREEN_INTENT, {
      data: `package:${pkg}`,
    });
  } catch {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, {
      data: `package:${pkg}`,
    });
  }
}
