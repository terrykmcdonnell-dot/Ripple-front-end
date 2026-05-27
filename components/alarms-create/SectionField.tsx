import { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { alarmTypography, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

type SectionFieldProps = {
  label: string;
  children: ReactNode;
  /** Shown under the field in warning color when validation fails. */
  errorMessage?: string;
};

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    field: {
      marginBottom: 14,
      width: '100%',
    },
    label: {
      fontSize: alarmTypography.micro,
      color: alarmTheme.muted,
      marginBottom: 16,
      letterSpacing: 1.4,
      textTransform: 'uppercase',
      fontFamily: 'monospace',
    },
    labelError: {
      color: alarmTheme.amber,
    },
    errorMessage: {
      marginTop: 8,
      color: alarmTheme.amber,
      fontSize: alarmTypography.caption,
      fontWeight: '600',
    },
  });
}

export function SectionField({ label, children, errorMessage }: SectionFieldProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  return (
    <View style={styles.field}>
      <Text style={[styles.label, errorMessage ? styles.labelError : null]}>{label}</Text>
      {children}
      {errorMessage ? <Text style={styles.errorMessage}>{errorMessage}</Text> : null}
    </View>
  );
}
