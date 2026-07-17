import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { IosAuthorizationStatus } from 'expo-notifications/build/NotificationPermissions.types';
import { Platform } from 'react-native';

import {
  getAndroidAlarmPermissionWarnings,
  type AndroidAlarmPermissionWarning,
} from '@/lib/android-alarm-permissions-status';
import { areIosCriticalAlertsConfigured } from '@/lib/ios-alarm-notification-options';
import { getNotificationAccessStatus } from '@/lib/notification-access-status';
import { requestNotificationAccess } from '@/lib/request-notification-access';

/** iOS notification permission — deferred until the user saves their first alarm. */
export async function requestIosNotificationPermissionIfNeeded(): Promise<void> {
  if (Platform.OS !== 'ios') {
    return;
  }

  try {
    const current = await getPermissionsAsync();
    const ios = current.ios;
    const iosStatus = ios?.status;
    const canPrompt = current.canAskAgain !== false;
    if (!canPrompt) {
      return;
    }

    const criticalAlertsConfigured = areIosCriticalAlertsConfigured();
    const criticalGranted = ios?.allowsCriticalAlerts === true;

    if (iosStatus === IosAuthorizationStatus.NOT_DETERMINED) {
      await requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          ...(criticalAlertsConfigured ? { allowCriticalAlerts: true } : {}),
        },
      });
      return;
    }

    if (criticalAlertsConfigured && current.granted && !criticalGranted) {
      await requestPermissionsAsync({
        ios: {
          allowAlert: true,
          allowBadge: true,
          allowSound: true,
          allowCriticalAlerts: true,
        },
      });
    }
  } catch {
    /* expo-notifications unavailable */
  }
}

/** OS + in-app notification access before scheduling alarms. */
export async function ensureNotificationAccessForAlarms(): Promise<void> {
  if (Platform.OS === 'web') {
    return;
  }

  const status = await getNotificationAccessStatus();
  if (status.alertsFullyEnabled) {
    return;
  }

  await requestNotificationAccess();
}

/**
 * Requests notification permission and returns any Android lock-screen settings
 * the user still needs to grant (full-screen intent, DND access).
 */
export async function prepareAlarmPermissionsForSetup(): Promise<AndroidAlarmPermissionWarning[]> {
  await requestIosNotificationPermissionIfNeeded();
  await ensureNotificationAccessForAlarms();
  const warnings = await getAndroidAlarmPermissionWarnings();
  return warnings.filter((w) => w.id !== 'exact_alarm');
}
