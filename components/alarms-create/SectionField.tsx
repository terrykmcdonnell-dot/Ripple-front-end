import { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

type SectionFieldProps = {
  label: string;
  children: ReactNode;
};

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    field: {
      marginBottom: 14,
      width: '100%',
    },
    label: {
      fontSize: 10,
      color: alarmTheme.muted,
      marginBottom: 14,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      fontFamily: 'monospace',
    },
  });
}

export function SectionField({ label, children }: SectionFieldProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}
