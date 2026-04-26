import { Pressable, StyleSheet, Text } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';

type DangerActionButtonProps = {
  icon: string;
  label: string;
  variant: 'skip' | 'delete';
  onPress?: () => void;
};

export function DangerActionButton({ icon, label, variant, onPress }: DangerActionButtonProps) {
  const isDelete = variant === 'delete';
  return (
    <Pressable
      onPress={onPress}
      style={[styles.base, isDelete ? styles.deleteBackground : styles.skipBackground]}>
      <Text style={[styles.text, isDelete ? styles.deleteText : styles.skipText]}>
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
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderColor: 'rgba(248,113,113,0.25)',
  },
  text: {
    fontSize: 14,
    fontWeight: '500',
  },
  skipText: {
    color: alarmTheme.text,
  },
  deleteText: {
    color: '#f87171',
  },
});
