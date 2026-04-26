import { Pressable, StyleSheet, Text } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';

type SocialAuthButtonProps = {
  icon: string;
  label: string;
};

export function SocialAuthButton({ icon, label }: SocialAuthButtonProps) {
  return (
    <Pressable style={styles.btn}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flex: 1,
    backgroundColor: alarmTheme.surface2,
    borderWidth: 1,
    borderColor: alarmTheme.border,
    borderRadius: 13,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  icon: {
    fontSize: 16,
  },
  label: {
    color: alarmTheme.text,
    fontSize: 13,
    fontWeight: '500',
  },
});
