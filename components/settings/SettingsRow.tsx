import { ReactNode, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

type SettingsRowProps = {
  icon: string;
  title: string;
  titleColor?: string;
  value?: string;
  valueColor?: string;
  /** Tint behind the emoji icon (e.g. About rows). Default: theme surface. */
  iconBackgroundColor?: string;
  right?: ReactNode;
  onPress?: () => void;
  noBorder?: boolean;
};

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
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
}

export function SettingsRow({
  icon,
  title,
  titleColor,
  value,
  valueColor,
  iconBackgroundColor,
  right,
  onPress,
  noBorder,
}: SettingsRowProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  const iconWrapStyle = [styles.iconWrap, iconBackgroundColor ? { backgroundColor: iconBackgroundColor } : null];

  const core = (
    <>
      <View style={iconWrapStyle}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <View style={styles.info}>
        <Text style={[styles.name, titleColor ? { color: titleColor } : null]}>{title}</Text>
        {value ? <Text style={[styles.value, valueColor ? { color: valueColor } : null]}>{value}</Text> : null}
      </View>
      {right}
    </>
  );

  const rowStyle = [styles.row, noBorder ? styles.noBorder : null];

  if (onPress) {
    return (
      <Pressable accessibilityRole="button" onPress={onPress} style={rowStyle}>
        {core}
      </Pressable>
    );
  }

  return <View style={rowStyle}>{core}</View>;
}
