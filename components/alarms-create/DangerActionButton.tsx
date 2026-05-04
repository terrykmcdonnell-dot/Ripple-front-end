import { Pressable, StyleSheet, Text } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';

type DangerActionButtonProps = {
  icon: string;
  label: string;
  variant: 'skip' | 'delete';
  onPress?: () => void;
  disabled?: boolean;
};

export function DangerActionButton({ icon, label, variant, onPress, disabled }: DangerActionButtonProps) {
  const isDelete = variant === 'delete';
  const isDisabled = disabled === true;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled }}
      disabled={isDisabled}
      onPress={onPress}
      android_ripple={{ color: isDelete ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.06)' }}
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

const styles = StyleSheet.create({
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
    backgroundColor: alarmTheme.surface2,
    borderColor: alarmTheme.border,
  },
  deleteBackground: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderColor: 'rgba(248,113,113,0.5)',
    borderWidth: 1,
  },
  deletePressed: {
    backgroundColor: 'rgba(239,68,68,0.28)',
    borderColor: 'rgba(251,146,146,0.7)',
  },
  skipPressed: {
    opacity: 0.92,
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
  },
  skipText: {
    color: alarmTheme.text,
  },
  deleteText: {
    color: '#fca5a5',
  },
  deleteTextEnabled: {
    fontWeight: '600',
    color: '#fecaca',
  },
  disabled: {
    opacity: 0.42,
  },
});
