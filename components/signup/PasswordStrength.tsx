import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';

type PasswordStrengthProps = {
  password: string;
};

type Strength = {
  activeBars: number;
  level: 'none' | 'weak' | 'medium' | 'strong';
  label: string;
  activeColor: string;
  labelColor: string;
};

function computeStrength(password: string): Strength {
  if (!password.length) {
    return {
      activeBars: 0,
      level: 'none',
      label: 'Password strength',
      activeColor: alarmTheme.surface3,
      labelColor: alarmTheme.muted,
    };
  }

  const len = password.length;
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasNum = /\d/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);
  const variety = [hasLower, hasUpper, hasNum, hasSpecial].filter(Boolean).length;

  // Length drives most of the bar fill; variety nudges up (caps at 4).
  let bars = Math.min(4, Math.ceil(len / 3));
  if (variety >= 2 && bars < 4) {
    bars += 1;
  }
  if (variety >= 3 && bars < 4) {
    bars += 1;
  }
  bars = Math.min(4, bars);

  if (bars <= 1) {
    return {
      activeBars: bars,
      level: 'weak',
      label: 'Weak strength',
      activeColor: alarmTheme.red,
      labelColor: alarmTheme.red,
    };
  }
  if (bars <= 3) {
    return {
      activeBars: bars,
      level: 'medium',
      label: 'Medium strength',
      activeColor: alarmTheme.amber,
      labelColor: alarmTheme.amber,
    };
  }
  return {
    activeBars: 4,
    level: 'strong',
    label: 'Strong strength',
    activeColor: alarmTheme.green,
    labelColor: alarmTheme.green,
  };
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = useMemo(() => computeStrength(password), [password]);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {[0, 1, 2, 3].map((idx) => {
          const isActive = idx < strength.activeBars;
          return (
            <View
              key={idx}
              style={[
                styles.bar,
                isActive ? { backgroundColor: strength.activeColor } : null,
              ]}
            />
          );
        })}
      </View>
      <Text style={[styles.label, { color: strength.labelColor }]}>{strength.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 4,
  },
  bar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: alarmTheme.surface3,
  },
  label: {
    marginTop: 4,
    fontSize: 10,
    fontFamily: 'monospace',
  },
});
