import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { signUpIcons } from '@/assets/icons/signup-icons';
import { alarmTheme } from '@/components/alarms/theme';
import { SignInField } from '@/components/signin/SignInField';
import { SocialAuthButton } from '@/components/signin/SocialAuthButton';
import { PasswordStrength } from '@/components/signup/PasswordStrength';
import { TermsAgreement } from '@/components/signup/TermsAgreement';
import { TopBrandRow } from '@/components/signup/TopBrandRow';
import { ValueBanner } from '@/components/signup/ValueBanner';

export default function SignUpScreen() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(true);
  const [termsChecked, setTermsChecked] = useState(true);
  const [fullName, setFullName] = useState('Alex Johnson');
  const [email, setEmail] = useState('you@example.com');
  const [password, setPassword] = useState('Create a password');

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={['rgba(6,182,212,0.15)', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.glowBg}
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <TopBrandRow onBack={() => router.push('/signin')} />

        <Text style={styles.title}>Create account</Text>
        <Text style={styles.subtitle}>
          Sync your alarms across all your devices with a free account.
        </Text>

        <ValueBanner />

        <SignInField
          label="Full Name"
          value={fullName}
          onChangeText={setFullName}
          rightIcon={signUpIcons.user}
          focused
        />

        <SignInField
          label="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          rightIcon={signUpIcons.email}
        />

        <View style={styles.passwordFieldWrap}>
          <SignInField
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Create a password"
            rightText={showPassword ? 'SHOW' : 'HIDE'}
            secure={showPassword}
            onToggleSecure={() => setShowPassword((v) => !v)}
          />
          <PasswordStrength level="medium" />
        </View>

        <TermsAgreement checked={termsChecked} onToggle={() => setTermsChecked((v) => !v)} />

        <Pressable style={styles.ctaBtn}>
          <Text style={styles.ctaText}>Create Account {signUpIcons.arrow}</Text>
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or sign up with</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialRow}>
          <SocialAuthButton icon={signUpIcons.apple} label="Apple" />
          <SocialAuthButton icon={signUpIcons.google} label="Google" />
        </View>

        <Text style={styles.footer}>
          Already have an account?{' '}
          <Text style={styles.footerLink} onPress={() => router.push('/signin')}>
            Sign in
          </Text>
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: alarmTheme.bg,
  },
  glowBg: {
    position: 'absolute',
    top: 40,
    left: '50%',
    marginLeft: -140,
    width: 280,
    height: 180,
    borderRadius: 140,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 58,
    paddingHorizontal: 24,
    paddingBottom: 28,
  },
  title: {
    color: alarmTheme.text,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  subtitle: {
    color: alarmTheme.muted,
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 19.5,
  },
  passwordFieldWrap: {
    width: '100%',
  },
  ctaBtn: {
    width: '100%',
    backgroundColor: alarmTheme.accent,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 14,
    shadowColor: alarmTheme.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: alarmTheme.border,
  },
  dividerText: {
    color: alarmTheme.muted,
    fontSize: 11,
    fontFamily: 'monospace',
  },
  socialRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  footer: {
    textAlign: 'center',
    fontSize: 13,
    color: alarmTheme.muted,
  },
  footerLink: {
    color: alarmTheme.accentBright,
    fontWeight: '600',
  },
});
