import { Platform } from 'react-native';

import * as IntentLauncher from 'expo-intent-launcher';

/**
 * Opens the system screen where the user can allow this app to access **Do Not Disturb** / notification
 * policy. On many devices this is required for alarm notification channels that use **bypassDnd** to take effect.
 */
export async function openAndroidNotificationPolicyAccessSettings(): Promise<void> {
  if (Platform.OS !== 'android') {
    return;
  }
  await IntentLauncher.startActivityAsync(
    IntentLauncher.ActivityAction.NOTIFICATION_POLICY_ACCESS_SETTINGS,
  );
}
