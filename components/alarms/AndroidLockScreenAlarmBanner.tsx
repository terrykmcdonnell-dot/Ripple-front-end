import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { useAlarmTheme } from '@/components/alarms/theme';
import {
  getAndroidAlarmPermissionWarnings,
  type AndroidAlarmPermissionWarning,
} from '@/lib/android-alarm-permissions-status';

/**
 * Persistent banner on the Alarms screen when full-screen intent and/or DND access is disabled.
 */
export function AndroidLockScreenAlarmBanner() {
  const palette = useAlarmTheme();
  const [warnings, setWarnings] = useState<AndroidAlarmPermissionWarning[]>([]);

  const refresh = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setWarnings([]);
      return;
    }
    setWarnings(await getAndroidAlarmPermissionWarnings());
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
        wrap: {
          marginHorizontal: 16,
          marginBottom: 8,
          gap: 8,
        },
        banner: {
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 10,
          backgroundColor: palette.amberDim,
          borderWidth: 1,
          borderColor: palette.amber,
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

  if (warnings.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      {warnings.map((warning) => (
        <Pressable
          key={warning.id}
          accessibilityRole="button"
          style={styles.banner}
          onPress={() => void warning.openSettings()}>
          <Text style={styles.title}>{warning.title}</Text>
          <Text style={styles.text}>{warning.body}</Text>
          <Text style={styles.action}>{warning.actionLabel}</Text>
        </Pressable>
      ))}
    </View>
  );
}
