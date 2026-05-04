import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

type SocialAuthButtonProps = {
  icon: string;
  label: string;
  onPress?: () => void;
};

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    btn: {
      flex: 1,
      backgroundColor: alarmTheme.surface2,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      borderRadius: 13,
      paddingVertical: 12,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    icon: {
      fontSize: 16,
    },
    label: {
      color: alarmTheme.text,
      fontSize: 13,
      fontWeight: '500',
    },
  });
}

export function SocialAuthButton({ icon, label, onPress }: SocialAuthButtonProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  return (
    <Pressable style={styles.btn} onPress={onPress}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}
