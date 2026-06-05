import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text } from 'react-native';

import { useAlarmTheme } from '@/components/alarms/theme';
import {
  getNotificationAccessStatus,
  notificationAccessStatusLabel,
} from '@/lib/notification-access-status';
import { requestNotificationAccess } from '@/lib/request-notification-access';

/**
 * Persistent banner on the Alarms screen when OS or in-app notifications are disabled.
 */
export function NotificationsDisabledBanner() {
  const palette = useAlarmTheme();
  const [show, setShow] = useState(false);
  const [statusLabel, setStatusLabel] = useState('');

  const refresh = useCallback(async () => {
    if (Platform.OS === 'web') {
      setShow(false);
      return;
    }
    const status = await getNotificationAccessStatus();
    setShow(!status.alertsFullyEnabled);
    setStatusLabel(notificationAccessStatusLabel(status));
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') {
          void refresh();
        }
      });
      return () => sub.remove();
    }, [refresh]),
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        banner: {
          marginHorizontal: 16,
          marginBottom: 8,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 10,
          backgroundColor: palette.redDim,
          borderWidth: 1,
          borderColor: palette.red,
        },
        title: {
          color: palette.text,
          fontSize: 13,
          fontWeight: '700',
          marginBottom: 4,
        },
        text: {
          color: palette.text,
          fontSize: 12,
          lineHeight: 17,
        },
        action: {
          color: palette.accentBright,
          fontWeight: '700',
          marginTop: 6,
          fontSize: 12,
        },
      }),
    [palette],
  );

  if (!show) {
    return null;
  }

  return (
    <Pressable
      accessibilityRole="button"
      style={styles.banner}
      onPress={() => void requestNotificationAccess().then(() => refresh())}>
      <Text style={styles.title}>Alarms cannot ring — notifications are off</Text>
      <Text style={styles.text}>
        Medication alarms need notification permission to show on your lock screen and play a sound.
      </Text>
      <Text style={styles.action}>{statusLabel} →</Text>
    </Pressable>
  );
}
