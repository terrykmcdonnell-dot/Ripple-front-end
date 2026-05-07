import * as Notifications from 'expo-notifications';

/** Clears the app icon badge when the user acts on a fired alarm from a notification. */
export async function clearMissedAlarmAppBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0).catch(() => undefined);
}
