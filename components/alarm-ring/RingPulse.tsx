import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

type RingPulseProps = {
  icon: string;
};

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    wrap: {
      width: 160,
      height: 160,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 36,
      position: 'relative',
    },
    ringLayerOne: {
      position: 'absolute',
      width: 160,
      height: 160,
      borderRadius: 80,
      borderWidth: 1.5,
      borderColor: alarmTheme.accent,
      opacity: 0.25,
      transform: [{ scale: 1.05 }],
    },
    ringLayerTwo: {
      position: 'absolute',
      width: 160,
      height: 160,
      borderRadius: 80,
      borderWidth: 1.5,
      borderColor: alarmTheme.accent,
      opacity: 0.45,
      transform: [{ scale: 0.85 }],
    },
    ringLayerThree: {
      position: 'absolute',
      width: 160,
      height: 160,
      borderRadius: 80,
      borderWidth: 1.5,
      borderColor: alarmTheme.accent,
      opacity: 0.65,
      transform: [{ scale: 0.65 }],
    },
    inner: {
      width: 96,
      height: 96,
      borderRadius: 48,
      backgroundColor: alarmTheme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: alarmTheme.accent,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 16,
      elevation: 6,
    },
    icon: {
      fontSize: 40,
    },
  });
}

export function RingPulse({ icon }: RingPulseProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);

  return (
    <View style={styles.wrap}>
      <View style={styles.ringLayerOne} />
      <View style={styles.ringLayerTwo} />
      <View style={styles.ringLayerThree} />
      <View style={styles.inner}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
    </View>
  );
}
