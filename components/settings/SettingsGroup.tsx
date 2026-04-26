import { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';

type SettingsGroupProps = {
  children: ReactNode;
};

export function SettingsGroup({ children }: SettingsGroupProps) {
  return <View style={styles.group}>{children}</View>;
}

const styles = StyleSheet.create({
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
