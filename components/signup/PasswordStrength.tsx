import { StyleSheet, Text, View } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';

type PasswordStrengthProps = {
  level: 'weak' | 'medium' | 'strong';
};

export function PasswordStrength({ level }: PasswordStrengthProps) {
  const activeBars = level === 'strong' ? 4 : level === 'medium' ? 3 : 2;
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {[0, 1, 2, 3].map((idx) => {
          const isActive = idx < activeBars;
          const isMediumBar = level === 'medium' && idx === 2;
          return (
            <View
              key={idx}
              style={[
                styles.bar,
                isActive ? styles.activeBar : null,
                isMediumBar ? styles.mediumBar : null,
              ]}
            />
          );
        })}
      </View>
      <Text style={styles.label}>{level === 'strong' ? 'Strong strength' : level === 'medium' ? 'Medium strength' : 'Weak strength'}</Text>
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
  activeBar: {
    backgroundColor: alarmTheme.green,
  },
  mediumBar: {
    backgroundColor: alarmTheme.amber,
  },
  label: {
    marginTop: 4,
    color: alarmTheme.green,
    fontSize: 10,
    fontFamily: 'monospace',
  },
});
