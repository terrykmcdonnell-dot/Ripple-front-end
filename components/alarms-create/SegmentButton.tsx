import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { alarmTypography, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

type SegmentButtonProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  compact?: boolean;
  rounded?: boolean;
  flex?: boolean;
  withIcon?: string;
};

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    base: {
      backgroundColor: alarmTheme.surface2,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    regular: {
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    compact: {
      paddingHorizontal: 11,
      paddingVertical: 7,
    },
    square: {
      borderRadius: 10,
    },
    rounded: {
      borderRadius: 20,
    },
    flex: {
      flex: 1,
    },
    text: {
      fontSize: alarmTypography.caption,
      color: alarmTheme.muted,
      fontWeight: '500',
    },
    activeBackground: {
      backgroundColor: alarmTheme.accentDim,
      borderColor: alarmTheme.accent,
    },
    activeText: {
      color: alarmTheme.accentBright,
    },
  });
}

export function SegmentButton({
  label,
  active,
  onPress,
  compact,
  rounded,
  flex,
  withIcon,
}: SegmentButtonProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.base,
        compact ? styles.compact : styles.regular,
        rounded ? styles.rounded : styles.square,
        flex ? styles.flex : null,
        active ? styles.activeBackground : null,
      ]}>
      <Text style={[styles.text, active ? styles.activeText : null]}>
        {withIcon ? `${withIcon} ` : ''}
        {label}
      </Text>
    </Pressable>
  );
}
