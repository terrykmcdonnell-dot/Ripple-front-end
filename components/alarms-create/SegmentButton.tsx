import { Pressable, StyleSheet, Text } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';

type SegmentButtonProps = {
  label: string;
  active?: boolean;
  onPress?: () => void;
  compact?: boolean;
  rounded?: boolean;
  flex?: boolean;
  withIcon?: string;
};

export function SegmentButton({
  label,
  active,
  onPress,
  compact,
  rounded,
  flex,
  withIcon,
}: SegmentButtonProps) {
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

const styles = StyleSheet.create({
  base: {
    backgroundColor: alarmTheme.surface2,
    borderWidth: 1,
    borderColor: alarmTheme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  regular: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  compact: {
    paddingHorizontal: 9,
    paddingVertical: 5,
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
    fontSize: 12,
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
