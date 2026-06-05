import '@/lib/alarm-history-notification-task';

import { DarkTheme, DefaultTheme, ThemeProvider, type Theme } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, type ReactNode } from 'react';
import { Platform } from 'react-native';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AlarmNotificationBootstrap } from '@/components/bootstrap/AlarmNotificationBootstrap';
import { AndroidDndAccessBootstrap } from '@/components/bootstrap/AndroidDndAccessBootstrap';
import { AndroidFsiPermissionBootstrap } from '@/components/bootstrap/AndroidFsiPermissionBootstrap';
import { AppVersionCheckBootstrap } from '@/components/bootstrap/AppVersionCheckBootstrap';
import { IosNotificationPermissionBootstrap } from '@/components/bootstrap/IosNotificationPermissionBootstrap';
import { NotificationAccessBootstrap } from '@/components/bootstrap/NotificationAccessBootstrap';
import { AlarmScheduleAuthSync } from '@/components/bootstrap/AlarmScheduleAuthSync';
import { RevenueCatBootstrap } from '@/components/bootstrap/RevenueCatBootstrap';
import { SupabaseAuthAutoRefreshBootstrap } from '@/components/bootstrap/SupabaseAuthAutoRefreshBootstrap';
import { AlarmThemeProvider, isAlarmPaletteDark, useAlarmTheme } from '@/components/alarms/theme';
import { AppToastProvider } from '@/components/ui/AppToastProvider';

import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
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
          // setNotificationHandler runs only while the app is in the foreground.
          // AlarmNotificationBootstrap opens the in-app ring screen from the received listener.
          //
          // Android: must set shouldShowList (or shouldShowBanner) true so shouldPresentAlert
          // is true. If both are false, expo-notifications skips posting the real notification
          // and plays sound via RingtoneManager on the NOTIFICATION stream — which is silent
          // when the ringer is muted. shouldShowList true forces the USAGE_ALARM channel +
          // full-screen intent path even in this handler. Tray entry is dismissed in the
          // received listener after the ring screen opens.
          //
          // iOS: shouldPlaySound false — expo-av uses playsInSilentModeIOS on the ring screen.
          // OS notification sound does not bypass the hardware mute switch without Critical Alerts.
          if (Platform.OS === 'android') {
            return {
              shouldShowBanner: false,
              shouldShowList: true,
              shouldPlaySound: true,
              shouldSetBadge: false,
            };
          }
          return {
            shouldShowBanner: false,
            shouldShowList: false,
            shouldPlaySound: false,
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

function ThemedNavigationShell({ children }: { children: ReactNode }) {
  const palette = useAlarmTheme();
  const isDark = isAlarmPaletteDark(palette);

  const navigationTheme = useMemo((): Theme => {
    if (isDark) {
      return DarkTheme;
    }
    return {
      ...DefaultTheme,
      colors: {
        ...DefaultTheme.colors,
        primary: palette.accent,
        background: palette.bg,
        card: palette.surface,
        text: palette.text,
        border: palette.border,
        notification: palette.accentBright,
      },
    };
  }, [isDark, palette]);

  return (
    <ThemeProvider value={navigationTheme}>
      {children}
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AlarmThemeProvider>
        <ThemedNavigationShell>
          <AppToastProvider>
            <AppVersionCheckBootstrap />
            <AlarmScheduleAuthSync />
            <SupabaseAuthAutoRefreshBootstrap />
            <RevenueCatBootstrap />
            <IosNotificationPermissionBootstrap />
            <NotificationAccessBootstrap />
            <AndroidFsiPermissionBootstrap />
            <AndroidDndAccessBootstrap />
            <AlarmNotificationBootstrap />
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
          </AppToastProvider>
        </ThemedNavigationShell>
      </AlarmThemeProvider>
    </SafeAreaProvider>
  );
}
