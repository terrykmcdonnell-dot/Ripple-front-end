import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

type SoundRowProps = {
  icon: string;
  title: string;
  onPress?: () => void;
};

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    row: {
      width: '100%',
      backgroundColor: alarmTheme.surface2,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 11,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    left: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 9,
    },
    icon: {
      fontSize: 14,
    },
    title: {
      fontSize: 13,
      color: alarmTheme.text,
    },
    arrow: {
      fontSize: 13,
      color: alarmTheme.muted,
    },
  });
}

export function SoundRow({ icon, title, onPress }: SoundRowProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.left}>
        <Text style={styles.icon}>{icon}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      <Text style={styles.arrow}>›</Text>
    </Pressable>
  );
}
