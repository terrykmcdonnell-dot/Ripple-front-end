import { getPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import type { NotificationPermissionsStatus } from 'expo-notifications/build/NotificationPermissions.types';
import { PermissionStatus } from 'expo-modules-core';
import { Platform } from 'react-native';

import { isOsNotificationAllowed } from '@/lib/notification-os-status';
import { loadNotificationsMasterEnabled } from '@/lib/settings-preferences';

export type NotificationAccessStatus = {
  osAllowed: boolean;
  masterEnabled: boolean;
  canAskAgain: boolean;
  /** OS permission granted and in-app notifications master switch on. */
  alertsFullyEnabled: boolean;
};

export async function getNotificationAccessStatus(): Promise<NotificationAccessStatus> {
  if (Platform.OS === 'web') {
    return {
      osAllowed: false,
      masterEnabled: true,
      canAskAgain: false,
      alertsFullyEnabled: false,
    };
  }

  let permission: NotificationPermissionsStatus = {
    granted: false,
    status: PermissionStatus.UNDETERMINED,
    canAskAgain: true,
    expires: 'never',
  };
  try {
    permission = await getPermissionsAsync();
  } catch {
    /* expo-notifications unavailable */
  }

  const osAllowed = isOsNotificationAllowed(permission);
  const masterEnabled = await loadNotificationsMasterEnabled();

  return {
    osAllowed,
    masterEnabled,
    canAskAgain: permission.canAskAgain !== false,
    alertsFullyEnabled: osAllowed && masterEnabled,
  };
}

/** Short label for banners and settings rows. */
export function notificationAccessStatusLabel(status: NotificationAccessStatus): string {
  if (!status.masterEnabled) {
    return 'Paused in app — turn on in Settings';
  }
  if (!status.osAllowed) {
    return status.canAskAgain ? 'Tap to enable notifications' : 'Off — open system Settings';
  }
  return 'Allowed';
}
