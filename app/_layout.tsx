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
import { RevenueCatBootstrap } from '@/components/bootstrap/RevenueCatBootstrap';
import { SupabaseAuthAutoRefreshBootstrap } from '@/components/bootstrap/SupabaseAuthAutoRefreshBootstrap';
import { AppToastProvider } from '@/components/ui/AppToastProvider';

import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { ALARM_FIRE_DATA_TYPE } from '@/lib/alarm-notification-constants';

/** Foreground presentation: alarm fires use full-screen ring UI only — no duplicate banner / tray row. */
function NotificationPresentationBootstrap() {
  useEffect(() => {
    if (Platform.OS === 'web') {
      return;
    }
    setNotificationHandler({
      handleNotification: async (notification) => {
        const data = notification.request.content.data as Record<string, unknown> | undefined;
        const isAlarmFire = data?.type === ALARM_FIRE_DATA_TYPE;
        if (isAlarmFire) {
          return {
            shouldShowBanner: false,
            shouldShowList: false,
            shouldPlaySound: true,
            shouldSetBadge: false,
          };
        }
        return {
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        };
      },
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
          <SupabaseAuthAutoRefreshBootstrap />
          <RevenueCatBootstrap />
          <AlarmNotificationBootstrap />
          <PushNotificationBootstrap />
          <NotificationPresentationBootstrap />
          <Stack>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="signin" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen name="forgot-password" options={{ headerShown: false }} />
            <Stack.Screen name="reset-password" options={{ headerShown: false }} />
            <Stack.Screen name="signup" options={{ headerShown: false }} />
            <Stack.Screen name="verify" options={{ headerShown: false }} />
            <Stack.Screen name="alarm" options={{ headerShown: false }} />
            <Stack.Screen name="alarm-ring" options={{ headerShown: false }} />
            <Stack.Screen name="paywall" options={{ headerShown: false }} />
          </Stack>
          <StatusBar style="auto" />
        </AppToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
