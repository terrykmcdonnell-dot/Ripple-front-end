import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';

type SettingsRowProps = {
  icon: string;
  title: string;
  titleColor?: string;
  value?: string;
  valueColor?: string;
  right?: ReactNode;
  onPress?: () => void;
  noBorder?: boolean;
};

export function SettingsRow({
  icon,
  title,
  titleColor,
  value,
  valueColor,
  right,
  onPress,
  noBorder,
}: SettingsRowProps) {
  return (
    <Pressable onPress={onPress} style={[styles.row, noBorder ? styles.noBorder : null]}>
      <View style={styles.iconWrap}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, titleColor ? { color: titleColor } : null]}>{title}</Text>
        {value ? <Text style={[styles.value, valueColor ? { color: valueColor } : null]}>{value}</Text> : null}
      </View>
      {right}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: alarmTheme.border,
  },
  noBorder: {
    borderBottomWidth: 0,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: alarmTheme.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  icon: {
    fontSize: 18,
  },
  info: {
    flex: 1,
  },
  name: {
    color: alarmTheme.text,
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 1,
  },
  value: {
    color: alarmTheme.muted,
    fontSize: 11,
  },
});
