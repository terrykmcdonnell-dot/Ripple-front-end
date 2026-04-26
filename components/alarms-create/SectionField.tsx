import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';

type SectionFieldProps = {
  label: string;
  children: ReactNode;
};

export function SectionField({ label, children }: SectionFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 14,
    width: '100%',
  },
  label: {
    fontSize: 10,
    color: alarmTheme.muted,
    marginBottom: 7,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    fontFamily: 'monospace',
  },
});
