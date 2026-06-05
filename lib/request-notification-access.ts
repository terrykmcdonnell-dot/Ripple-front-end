import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { Linking, Platform } from 'react-native';

import { isOsNotificationAllowed } from '@/lib/notification-os-status';
import { saveNotificationsMasterEnabled } from '@/lib/settings-preferences';

export type RequestNotificationAccessResult =
  | { ok: true }
  | { ok: false; openedSettings: boolean };

/**
 * Requests OS notification permission when possible; opens system Settings if still blocked.
 * Re-enables the in-app notifications master switch when the user is trying to turn alerts on.
 */
export async function requestNotificationAccess(): Promise<RequestNotificationAccessResult> {
  if (Platform.OS === 'web') {
    return { ok: false, openedSettings: false };
  }

  await saveNotificationsMasterEnabled(true);

  try {
    const current = await getPermissionsAsync();
    if (!isOsNotificationAllowed(current) && current.canAskAgain !== false) {
      await requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
        },
      });
    }
  } catch {
    /* expo-notifications unavailable */
  }

  try {
    const after = await getPermissionsAsync();
    if (isOsNotificationAllowed(after)) {
      return { ok: true };
    }
  } catch {
    /* ignore */
  }

  try {
    await Linking.openSettings();
    return { ok: false, openedSettings: true };
  } catch {
    return { ok: false, openedSettings: false };
  }
}
