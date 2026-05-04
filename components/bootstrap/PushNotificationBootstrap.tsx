import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

import { registerAndPersistExpoPushToken } from '@/lib/expo-push-registration';

/** Registers for remote push (Expo push token), persists token, and refreshes when the OS rotates the device token. */
export function PushNotificationBootstrap() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }

    void registerAndPersistExpoPushToken();

    const sub = Notifications.addPushTokenListener(() => {
      void registerAndPersistExpoPushToken();
    });

    return () => {
      sub.remove();
    };
  }, []);

  return null;
}
