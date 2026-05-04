import type { NotificationPermissionsStatus } from 'expo-notifications/build/NotificationPermissions.types';
import { IosAuthorizationStatus } from 'expo-notifications/build/NotificationPermissions.types';
import { Platform } from 'react-native';

/** Whether the OS allows this app to deliver notifications (includes iOS provisional). */
export function isOsNotificationAllowed(status: NotificationPermissionsStatus): boolean {
  if (status.granted) {
    return true;
  }
  if (
    Platform.OS === 'ios' &&
    status.ios?.status === IosAuthorizationStatus.PROVISIONAL
  ) {
    return true;
  }
  return false;
}
