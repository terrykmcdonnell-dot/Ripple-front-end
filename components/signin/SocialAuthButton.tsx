import FontAwesome5 from '@expo/vector-icons/FontAwesome5';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

export type SocialAuthProvider = 'apple' | 'google';

type SocialAuthButtonProps = {
  provider: SocialAuthProvider;
  label: string;
  onPress?: () => void;
};

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
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
    iconWrap: {
      width: 20,
      height: 20,
      alignItems: 'center',
      justifyContent: 'center',
    },
    label: {
      color: alarmTheme.text,
      fontSize: 13,
      fontWeight: '500',
    },
  });
}

export function SocialAuthButton({ provider, label, onPress }: SocialAuthButtonProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  const iconColor = useMemo(() => {
    if (provider === 'google') {
      // Brand “G” reads clearly on dark surfaces without multi-layer SVGs.
      return '#4285F4';
    }
    return alarmTheme.text;
  }, [alarmTheme.text, provider]);

  return (
    <Pressable style={styles.btn} onPress={onPress}>
      <View style={styles.iconWrap}>
        <FontAwesome5 name={provider} size={18} color={iconColor} brand />
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}
