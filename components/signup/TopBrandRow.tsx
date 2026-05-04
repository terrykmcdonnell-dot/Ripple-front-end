import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { signUpIcons } from '@/assets/icons/signup-icons';
import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

type TopBrandRowProps = {
  onBack?: () => void;
};

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
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
}

export function TopBrandRow({ onBack }: TopBrandRowProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

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
