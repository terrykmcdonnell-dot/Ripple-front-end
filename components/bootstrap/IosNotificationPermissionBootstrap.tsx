import { useEffect } from 'react';
import { Platform } from 'react-native';

import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { IosAuthorizationStatus } from 'expo-notifications/build/NotificationPermissions.types';

import { areIosCriticalAlertsConfigured } from '@/lib/ios-alarm-notification-options';

/**
 * iOS notification permission on app open:
 * - First install: request alert + sound.
 * - Critical Alerts are requested only when the build is configured with Apple's
 *   critical-alerts entitlement; otherwise iOS uses Time Sensitive alarms.
 */
export function IosNotificationPermissionBootstrap() {
  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        const current = await getPermissionsAsync();
        if (cancelled) {
          return;
        }

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
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
