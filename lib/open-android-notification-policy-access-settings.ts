import { Platform } from 'react-native';

import * as IntentLauncher from 'expo-intent-launcher';

/**
 * Guards against overlapping `startActivityAsync` calls. Multiple entry points
 * (Settings row, first-launch bootstrap modal) can trigger this within the same
 * gesture — e.g. a double-tap — and Android rejects a second `startActivity`
 * while the first is still resolving with "activity is already started"
 * (see Sentry RIPPLE-ALARM-D). While a launch is in flight, reuse it instead of
 * firing another intent.
 */
let inFlight: Promise<void> | null = null;

/**
 * Opens the system screen where the user can allow this app to access **Do Not Disturb** / notification
 * policy. On many devices this is required for alarm notification channels that use **bypassDnd** to take effect.
 */
export async function openAndroidNotificationPolicyAccessSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  if (inFlight) {
    return inFlight;
  }

  inFlight = IntentLauncher.startActivityAsync(
    IntentLauncher.ActivityAction.NOTIFICATION_POLICY_ACCESS_SETTINGS,
  ).then(() => undefined);

  try {
    await inFlight;
  } finally {
    inFlight = null;
  }
}
