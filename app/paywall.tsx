import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { paywallIcons } from '@/assets/icons/paywall-icons';
import { alarmTheme } from '@/components/alarms/theme';
import { FeatureRow } from '@/components/paywall/FeatureRow';
import { PricingPlan, PricingToggle } from '@/components/paywall/PricingToggle';
import { useRequireAuth } from '@/hooks/use-require-auth';

export default function PaywallScreen() {
  useRequireAuth();
  const router = useRouter();
  const [plan, setPlan] = useState<PricingPlan>('annual');

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <View style={styles.glowBg} />

      <Pressable style={styles.closeBtn} onPress={() => router.push('/setting')}>
        <Text style={styles.closeText}>{paywallIcons.close}</Text>
      </Pressable>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.proIconWrap}>
          <View style={styles.proIconCircle}>
            <Text style={styles.proIcon}>{paywallIcons.pro}</Text>
          </View>
        </View>

        <View style={styles.limitBox}>
          <Text style={styles.limitText}>You&apos;ve reached the 5-alarm free limit</Text>
        </View>

        <Text style={styles.headline}>
          Unlock <Text style={styles.headlineAccent}>Ripple Pro</Text>
        </Text>
        <Text style={styles.sub}>
          Unlimited alarms, cloud sync, widgets and more - for less than a coffee a month.
        </Text>

        <View style={styles.features}>
          <FeatureRow text="Unlimited alarms - no cap, ever" />
          <FeatureRow text="Home screen widget (iOS + Android)" />
          <FeatureRow text="iCloud & Google sync across devices" />
          <FeatureRow text="Premium themes" />
          <FeatureRow text="Template gallery access" />
        </View>

        <PricingToggle selected={plan} onSelect={setPlan} />

        <LinearGradient
          colors={['#06b6d4', '#0891b2']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ctaBtn}>
          <Text style={styles.ctaText}>Start 7-Day Free Trial {paywallIcons.arrow}</Text>
        </LinearGradient>

        <Text style={styles.trialNote}>No charge until trial ends · Cancel anytime</Text>
        <Text style={styles.restore}>Restore previous purchase</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: alarmTheme.bg,
  },
  closeBtn: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: alarmTheme.surface2,
    borderWidth: 1,
    borderColor: alarmTheme.border,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  closeText: {
    color: alarmTheme.muted,
    fontSize: 14,
  },
  glowBg: {
    position: 'absolute',
    top: 80,
    left: '50%',
    marginLeft: -150,
    width: 300,
    height: 200,
    borderRadius: 150,
    backgroundColor: 'rgba(6,182,212,0.18)',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 50,
    elevation: 0,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 54,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  proIconWrap: {
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  proIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: alarmTheme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 5,
  },
  proIcon: {
    fontSize: 32,
  },
  limitBox: {
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.2)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    marginBottom: 16,
  },
  limitText: {
    color: '#f87171',
    fontSize: 12,
  },
  headline: {
    color: alarmTheme.text,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
    marginBottom: 6,
    lineHeight: 30,
  },
  headlineAccent: {
    color: alarmTheme.accentBright,
  },
  sub: {
    color: alarmTheme.muted,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 24,
  },
  features: {
    gap: 8,
    marginBottom: 24,
  },
  ctaBtn: {
    width: '100%',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 10,
    shadowColor: '#06b6d4',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  trialNote: {
    color: alarmTheme.muted,
    fontSize: 11,
    textAlign: 'center',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  restore: {
    color: alarmTheme.muted,
    fontSize: 12,
    textAlign: 'center',
  },
});
