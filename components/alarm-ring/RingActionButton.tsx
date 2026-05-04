import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

type RingActionButtonProps = {
  icon: string;
  label: string;
  variant: 'snooze' | 'dismiss';
  onPress?: () => void;
};

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    base: {
      flex: 1,
      borderRadius: 16,
      paddingVertical: 18,
      alignItems: 'center',
      justifyContent: 'center',
    },
    snooze: {
      backgroundColor: alarmTheme.surface2,
      borderWidth: 1,
      borderColor: alarmTheme.border,
    },
    dismiss: {
      backgroundColor: alarmTheme.accent,
      shadowColor: alarmTheme.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 10,
      elevation: 4,
    },
    text: {
      fontSize: 14,
      fontWeight: '600',
    },
    snoozeText: {
      color: alarmTheme.text,
    },
    dismissText: {
      color: '#ffffff',
    },
  });
}

export function RingActionButton({ icon, label, variant, onPress }: RingActionButtonProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);
  const dismiss = variant === 'dismiss';

  return (
    <Pressable onPress={onPress} style={[styles.base, dismiss ? styles.dismiss : styles.snooze]}>
      <Text style={[styles.text, dismiss ? styles.dismissText : styles.snoozeText]}>
        {icon} {label}
      </Text>
    </Pressable>
  );
}
