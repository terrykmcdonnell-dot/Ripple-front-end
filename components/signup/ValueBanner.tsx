import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { signUpIcons } from '@/assets/icons/signup-icons';
import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    banner: {
      backgroundColor: alarmTheme.accentDim,
      borderWidth: 1,
      borderColor: alarmTheme.accentBannerBorder,
      borderRadius: 13,
      paddingVertical: 11,
      paddingHorizontal: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 20,
      width: '100%',
    },
    icon: {
      fontSize: 20,
    },
    text: {
      flex: 1,
      color: alarmTheme.accentBright,
      fontSize: 12,
      lineHeight: 18,
    },
    strong: {
      fontWeight: '700',
    },
  });
}

export function ValueBanner() {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  return (
    <View style={styles.banner}>
      <Text style={styles.icon}>{signUpIcons.cloud}</Text>
      <Text style={styles.text}>
        <Text style={styles.strong}>Free account includes cloud sync.</Text> Upgrade to Pro for unlimited alarms
        and widgets.
      </Text>
    </View>
  );
}
