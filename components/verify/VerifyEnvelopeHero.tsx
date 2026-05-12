import { useEffect } from 'react';
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

import { verifyIcons } from '@/assets/icons/verify-icons';

type VerifyEnvelopeHeroProps = {
  accent: string;
  accentBannerBorder: string;
};

export function VerifyEnvelopeHero({ accent, accentBannerBorder }: VerifyEnvelopeHeroProps) {
  const wave = useSharedValue(0);
  const bob = useSharedValue(0);

  useEffect(() => {
    wave.value = withRepeat(
      withTiming(1, { duration: 1600, easing: Easing.linear }),
      -1,
      false,
    );
    bob.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1000, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
  }, [wave, bob]);

  const ring1Style = useAnimatedStyle(() => {
    const phase = wave.value * Math.PI * 2;
    const wobble = Math.sin(phase) * 0.035;
    return {
      transform: [{ scale: 1 + wobble }],
      opacity: 0.52 + Math.sin(phase) * 0.14,
    };
  });

  const ring2Style = useAnimatedStyle(() => {
    const phase = wave.value * Math.PI * 2 + 1.15;
    const wobble = Math.sin(phase) * 0.045;
    return {
      transform: [{ scale: 1.32 + wobble }],
      opacity: 0.26 + Math.sin(phase) * 0.1,
    };
  });

  const ring3Style = useAnimatedStyle(() => {
    const phase = wave.value * Math.PI * 2 + 2.35;
    const wobble = Math.sin(phase) * 0.055;
    return {
      transform: [{ scale: 1.62 + wobble }],
      opacity: 0.12 + Math.sin(phase) * 0.08,
    };
  });

  const bobStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(bob.value, [0, 1], [3, -6]) }],
  }));

  return (
    <View style={styles.envelopeWrap}>
      <Animated.View style={[styles.envRing, ring1Style, { borderColor: accentBannerBorder }]} />
      <Animated.View style={[styles.envRing, ring2Style, { borderColor: accentBannerBorder }]} />
      <Animated.View style={[styles.envRing, ring3Style, { borderColor: accentBannerBorder }]} />
      <Animated.View style={bobStyle}>
        <View style={[styles.envCircle, { backgroundColor: accent, shadowColor: accent }]}>
          <Text style={styles.envEmoji}>{verifyIcons.envelope}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  envelopeWrap: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  envRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 1,
  },
  envCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 4,
  },
  envEmoji: {
    fontSize: 30,
  },
});
