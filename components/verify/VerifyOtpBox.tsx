import { StyleSheet, Text, View } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';

type VerifyOtpBoxProps = {
  value?: string;
  active?: boolean;
};

export function VerifyOtpBox({ value, active = false }: VerifyOtpBoxProps) {
  const filled = Boolean(value);

  return (
    <View style={[styles.box, filled ? styles.filledBox : null, active ? styles.activeBox : null]}>
      <Text
        style={[
          styles.text,
          filled ? styles.filledText : null,
          !filled && !active ? styles.emptyText : null,
          !filled && active ? styles.cursor : null,
        ]}>
        {value || (active ? '_' : '')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    width: '100%',
    height: 58,
    borderRadius: 14,
    backgroundColor: alarmTheme.surface2,
    borderWidth: 1,
    borderColor: alarmTheme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filledBox: {
    borderColor: alarmTheme.accent,
    backgroundColor: alarmTheme.accentDim,
  },
  activeBox: {
    borderColor: alarmTheme.accent,
    shadowColor: alarmTheme.accent,
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  text: {
    fontSize: 26,
    fontWeight: '800',
    color: alarmTheme.text,
    fontFamily: 'monospace',
  },
  filledText: {
    color: alarmTheme.accentBright,
  },
  emptyText: {
    color: alarmTheme.muted,
  },
  cursor: {
    color: alarmTheme.text,
  },
});
