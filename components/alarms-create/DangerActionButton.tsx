import { useMemo } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

type DangerActionButtonProps = {
  icon: string;
  label: string;
  variant: 'skip' | 'delete';
  onPress?: () => void;
  disabled?: boolean;
};

function createStyles(t: AlarmThemePalette) {
  return StyleSheet.create({
    base: {
      width: '100%',
      borderRadius: 12,
      paddingVertical: 13,
      paddingHorizontal: 12,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    skipBackground: {
      backgroundColor: t.surface2,
      borderColor: t.border,
    },
    deleteBackground: {
      backgroundColor: t.redDim,
      borderColor: `${t.red}88`,
      borderWidth: 1,
    },
    deletePressed: {
      backgroundColor: t.redDim,
      borderColor: t.red,
    },
    skipPressed: {
      opacity: 0.92,
    },
    text: {
      fontSize: 14,
      fontWeight: '500',
    },
    skipText: {
      color: t.text,
    },
    deleteText: {
      color: t.red,
      opacity: 0.85,
    },
    deleteTextEnabled: {
      fontWeight: '600',
      color: t.red,
      opacity: 1,
    },
    disabled: {
      opacity: 0.42,
    },
  });
}

export function DangerActionButton({ icon, label, variant, onPress, disabled }: DangerActionButtonProps) {
  const theme = useAlarmTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const isDelete = variant === 'delete';
  const isDisabled = disabled === true;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      android_ripple={{ color: isDelete ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.06)' }}
      hitSlop={isDelete ? { top: 6, bottom: 6, left: 4, right: 4 } : undefined}
      style={({ pressed }) => [
        styles.base,
        isDelete ? styles.deleteBackground : styles.skipBackground,
        !isDisabled && pressed && !isDelete && styles.skipPressed,
        !isDisabled && pressed && isDelete && styles.deletePressed,
        isDisabled && styles.disabled,
      ]}>
      <Text
        style={[
          styles.text,
          isDelete ? styles.deleteText : styles.skipText,
          !isDisabled && isDelete && styles.deleteTextEnabled,
        ]}>
        {icon} {label}
      </Text>
    </Pressable>
  );
}
