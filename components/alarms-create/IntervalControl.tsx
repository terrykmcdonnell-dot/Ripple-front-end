import { Pressable, StyleSheet, Text, View } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';

type IntervalControlProps = {
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
};

export function IntervalControl({ value, onDecrease, onIncrease }: IntervalControlProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>Interval</Text>
      <View style={styles.controls}>
        <Pressable onPress={onDecrease} style={styles.btn}>
          <Text style={styles.btnText}>-</Text>
        </Pressable>
        <Text style={styles.value}>{value}</Text>
        <Pressable onPress={onIncrease} style={styles.btn}>
          <Text style={styles.btnText}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    backgroundColor: alarmTheme.surface2,
    borderWidth: 1,
    borderColor: alarmTheme.border,
    borderRadius: 12,
    paddingHorizontal: 13,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  label: {
    flex: 1,
    color: alarmTheme.muted,
    fontSize: 13,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  btn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: alarmTheme.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: alarmTheme.text,
    fontSize: 18,
    lineHeight: 18,
  },
  value: {
    color: alarmTheme.text,
    fontSize: 20,
    minWidth: 28,
    textAlign: 'center',
    fontFamily: 'monospace',
    fontWeight: '700',
  },
});
