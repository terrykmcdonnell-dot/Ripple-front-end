import { Pressable, StyleSheet, Text, View } from 'react-native';

import { verifyIcons } from '@/assets/icons/verify-icons';
import { alarmTheme } from '@/components/alarms/theme';

type VerifyHelpNoteProps = {
  onSupportPress?: () => void;
};

export function VerifyHelpNote({ onSupportPress }: VerifyHelpNoteProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.icon}>{verifyIcons.hint}</Text>
      <Text style={styles.text}>
        Check your spam folder if you don&apos;t see it. Still stuck?{' '}
        <Pressable onPress={onSupportPress}>
          <Text style={styles.link}>Contact support</Text>
        </Pressable>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: alarmTheme.surface,
    borderWidth: 1,
    borderColor: alarmTheme.border,
    borderRadius: 13,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  icon: {
    fontSize: 16,
    marginTop: 1,
  },
  text: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: alarmTheme.muted,
  },
  link: {
    color: alarmTheme.accentBright,
  },
});
