import { useEffect } from 'react';
import { Platform } from 'react-native';

import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { IosAuthorizationStatus } from 'expo-notifications/build/NotificationPermissions.types';

/**
 * iOS notification permission on app open:
 * - First install: request alert + sound + critical alerts together.
 * - Existing users who allowed notifications before critical was added: re-request
 *   critical-only so muted-switch alarms can use interruptionLevel "critical".
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

        const criticalGranted = ios?.allowsCriticalAlerts === true;

        if (iosStatus === IosAuthorizationStatus.NOT_DETERMINED) {
          await requestPermissionsAsync({
            ios: {
              allowAlert: true,
              allowBadge: true,
              allowSound: true,
              // allowCriticalAlerts: true — add back once Apple approves the
              // critical-alerts entitlement and it is included in the provisioning profile.
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
