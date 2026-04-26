import { Pressable, StyleSheet, Text, View } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';
import { signUpIcons } from '@/assets/icons/signup-icons';

type TopBrandRowProps = {
  onBack?: () => void;
};

export function TopBrandRow({ onBack }: TopBrandRowProps) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.backBtn} onPress={onBack}>
        <Text style={styles.backText}>{signUpIcons.back}</Text>
      </Pressable>
      <Text style={styles.logo}>
        Rip<Text style={styles.logoAccent}>ple</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 22,
  },
  backBtn: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: alarmTheme.surface2,
    borderWidth: 1,
    borderColor: alarmTheme.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: alarmTheme.muted,
    fontSize: 14,
  },
  logo: {
    color: alarmTheme.text,
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  logoAccent: {
    color: alarmTheme.accentBright,
  },
});
