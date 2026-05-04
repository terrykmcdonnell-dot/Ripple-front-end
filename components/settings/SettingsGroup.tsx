import { ReactNode, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

type SettingsGroupProps = {
  children: ReactNode;
};

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    group: {
      width: '100%',
      backgroundColor: alarmTheme.surface,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 4,
    },
  });
}

export function SettingsGroup({ children }: SettingsGroupProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);
  return <View style={styles.group}>{children}</View>;
}
