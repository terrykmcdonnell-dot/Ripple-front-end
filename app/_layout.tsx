import '@/lib/alarm-history-notification-task';

import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AlarmNotificationBootstrap } from '@/components/bootstrap/AlarmNotificationBootstrap';
import { AlarmScheduleAuthSync } from '@/components/bootstrap/AlarmScheduleAuthSync';
import { PushNotificationBootstrap } from '@/components/bootstrap/PushNotificationBootstrap';
import { AppToastProvider } from '@/components/ui/AppToastProvider';
import { syncPersistedAlarmVolumeToSystem } from '@/lib/alarm-system-volume';
import { loadDefaultVolumePercent } from '@/lib/settings-preferences';

import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';

import { useColorScheme } from '@/hooks/use-color-scheme';

/** Restore saved Settings → Volume to the system notification stream on launch (dev client / production). */
function AlarmVolumeBootstrap() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    let cancelled = false;
    void loadDefaultVolumePercent().then((percent) => {
      if (!cancelled) {
        void syncPersistedAlarmVolumeToSystem(percent);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}

/** Required so scheduled snooze notifications show while the app is foregrounded. */
function NotificationPresentationBootstrap() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  }, []);
  return null;
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AppToastProvider>
          <AlarmScheduleAuthSync />
          <AlarmNotificationBootstrap />
          <PushNotificationBootstrap />
          <NotificationPresentationBootstrap />
          <AlarmVolumeBootstrap />
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="signin" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
            <Stack.Screen name="reset-password" options={{ headerShown: false }} />
            <Stack.Screen name="signup" options={{ headerShown: false }} />
            <Stack.Screen name="verify" options={{ headerShown: false }} />
            <Stack.Screen name="alarm" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="auto" />
        </AppToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
