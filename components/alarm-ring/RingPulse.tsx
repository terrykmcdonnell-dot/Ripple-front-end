import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

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
    ringBase: {
      position: 'absolute',
      width: 160,
      height: 160,
      borderRadius: 80,
      borderWidth: 1.5,
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

  const wave = useSharedValue(0);
  const breathe = useSharedValue(0);

  useEffect(() => {
    wave.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.linear }),
      -1,
      false,
    );
    breathe.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [wave, breathe]);

  const ringOneStyle = useAnimatedStyle(() => {
    const phase = wave.value * Math.PI * 2;
    const wobble = Math.sin(phase) * 0.045;
    return {
      transform: [{ scale: 1.05 + wobble }],
      opacity: 0.2 + Math.sin(phase) * 0.1,
    };
  });

  const ringTwoStyle = useAnimatedStyle(() => {
    const phase = wave.value * Math.PI * 2 + 1.2;
    const wobble = Math.sin(phase) * 0.055;
    return {
      transform: [{ scale: 0.85 + wobble }],
      opacity: 0.38 + Math.sin(phase) * 0.14,
    };
  });

  const ringThreeStyle = useAnimatedStyle(() => {
    const phase = wave.value * Math.PI * 2 + 2.45;
    const wobble = Math.sin(phase) * 0.065;
    return {
      transform: [{ scale: 0.65 + wobble }],
      opacity: 0.52 + Math.sin(phase) * 0.15,
    };
  });

  const innerScaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(breathe.value, [0, 1], [1, 1.1]) }],
  }));

  const ringBorder = { borderColor: alarmTheme.accent };

  return (
    <View style={styles.wrap}>
      <Animated.View style={[styles.ringBase, ringBorder, ringOneStyle]} />
      <Animated.View style={[styles.ringBase, ringBorder, ringTwoStyle]} />
      <Animated.View style={[styles.ringBase, ringBorder, ringThreeStyle]} />
      <Animated.View style={[styles.inner, innerScaleStyle]}>
        <Text style={styles.icon}>{icon}</Text>
      </Animated.View>
    </View>
  );
}
