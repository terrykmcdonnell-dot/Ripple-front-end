import Constants from 'expo-constants';
import { Platform } from 'react-native';

import * as IntentLauncher from 'expo-intent-launcher';

/**
 * Guards against overlapping `startActivityAsync` calls. Multiple entry points
 * (Settings row, first-launch bootstrap modal, post-save prompt) can all trigger
 * this within the same gesture/frame — e.g. a double-tap — and Android rejects a
 * second `startActivity` while the first is still resolving with
 * "activity is already started" (see Sentry RIPPLE-ALARM-D). While a launch is
 * in flight, reuse it instead of firing another intent.
 */
let inFlight: Promise<void> | null = null;

/** Android 14+ can restrict full-screen intents; opens the system page to allow them for this app. */
export async function openAndroidFullScreenAlarmPermissionSettings(): Promise<void> {
  if (Platform.OS !== 'android' || Platform.Version < 34) {
    return;
  }
  if (inFlight) {
    return inFlight;
  }
  const pkg = Constants.expoConfig?.android?.package?.trim() || 'com.terrykm.ripplealarmapp';
  if (!pkg) {
    return;
  }

  inFlight = (async () => {
    try {
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.MANAGE_APP_USE_FULL_SCREEN_INTENT, {
        data: `package:${pkg}`,
      });
    } catch {
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APPLICATION_DETAILS_SETTINGS, {
        data: `package:${pkg}`,
      });
    }
  })();

  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}
