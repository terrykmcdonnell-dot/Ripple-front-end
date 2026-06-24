import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { alarmTypography, type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { categoryChipActiveStyle } from '@/lib/category-colors';
import type { AlarmCategoryColorKey } from '@/lib/alarm-categories';

type SegmentButtonProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  compact?: boolean;
  rounded?: boolean;
  flex?: boolean;
  withIcon?: string;
  /** When active, tints the chip with the category accent color. */
  activeColorKey?: AlarmCategoryColorKey;
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
  activeColorKey,
}: SegmentButtonProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);
  const accentStyle = active && activeColorKey ? categoryChipActiveStyle(alarmTheme, activeColorKey) : null;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.base,
        compact ? styles.compact : styles.regular,
        rounded ? styles.rounded : styles.square,
        flex ? styles.flex : null,
        active && !accentStyle ? styles.activeBackground : null,
        accentStyle
          ? {
              backgroundColor: accentStyle.backgroundColor,
              borderColor: accentStyle.borderColor,
            }
          : null,
      ]}>
      <Text
        style={[
          styles.text,
          active && !accentStyle ? styles.activeText : null,
          accentStyle ? { color: accentStyle.textColor } : null,
        ]}>
        {withIcon ? `${withIcon} ` : ''}
        {label}
      </Text>
    </Pressable>
  );
}
