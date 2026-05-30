import { useEffect } from 'react';
import { Platform } from 'react-native';

import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { IosAuthorizationStatus } from 'expo-notifications/build/NotificationPermissions.types';

/**
 * Ask iOS notification permission on first app open.
 * iOS only shows the system dialog while status is `NOT_DETERMINED`.
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

        const iosStatus = current.ios?.status;
        const canPrompt = current.canAskAgain !== false;
        const notDetermined = iosStatus === IosAuthorizationStatus.NOT_DETERMINED;
        if (!notDetermined || !canPrompt) {
          return;
        }

        await requestPermissionsAsync({
          ios: { allowAlert: true, allowBadge: true, allowSound: true },
        });
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
