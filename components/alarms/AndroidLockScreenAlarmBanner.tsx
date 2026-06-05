import { useEffect, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, Text } from 'react-native';

import { useAlarmTheme } from '@/components/alarms/theme';
import { isAndroidFullScreenIntentGranted } from '@/lib/android-full-screen-intent-granted';
import { openAndroidFullScreenAlarmPermissionSettings } from '@/lib/open-android-full-screen-alarm-settings';

/**
 * Android 14+: warns when full-screen lock-screen alarms are disabled in system settings.
 */
export function AndroidLockScreenAlarmBanner() {
  const palette = useAlarmTheme();
  const [needsPermission, setNeedsPermission] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'android' || (Platform.Version as number) < 34) {
      return;
    }

    let cancelled = false;
    const refresh = async () => {
      const granted = await isAndroidFullScreenIntentGranted();
      if (!cancelled) {
        setNeedsPermission(!granted);
      }
    };

    void refresh();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void refresh();
      }
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);

  if (!needsPermission) {
    return null;
  }

  const styles = StyleSheet.create({
    banner: {
      marginHorizontal: 16,
      marginBottom: 8,
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 10,
      backgroundColor: palette.amberDim,
      borderWidth: 1,
      borderColor: palette.amber,
    },
    text: {
      color: palette.text,
      fontSize: 12,
      lineHeight: 17,
    },
    action: {
      color: palette.accentBright,
      fontWeight: '700',
      marginTop: 4,
      fontSize: 12,
    },
  });

  return (
    <Pressable
      accessibilityRole="button"
      style={styles.banner}
      onPress={() => void openAndroidFullScreenAlarmPermissionSettings()}>
      <Text style={styles.text}>
        Lock-screen alarms need &quot;Full screen intents&quot; enabled. Without it you only get a small
        notification banner.
      </Text>
      <Text style={styles.action}>Tap to open Settings → turn Ripple ON</Text>
    </Pressable>
  );
}
