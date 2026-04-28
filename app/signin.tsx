import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { signInIcons } from '@/assets/icons/signin-icons';
import { alarmTheme } from '@/components/alarms/theme';
import { SignInField } from '@/components/signin/SignInField';
import { SocialAuthButton } from '@/components/signin/SocialAuthButton';
import { useGoogleAuthWithSupabase } from '@/hooks/use-google-auth';
import { useRedirectIfAuthenticated } from '@/hooks/use-redirect-if-authenticated';
import { notifyAuthError, notifyAuthMessage } from '@/lib/auth-notify';
import { isValidEmail, sanitizeEmailInput } from '@/lib/auth-validation';
import { supabase } from '@/lib/supabase';

export default function SignInScreen() {
  useRedirectIfAuthenticated();
  const router = useRouter();
  const { googleLoading, onGooglePress } = useGoogleAuthWithSupabase();
  const [showPassword, setShowPassword] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [signInLoading, setSignInLoading] = useState(false);

  const onSignInPress = async () => {
    const emailValue = email.trim().toLowerCase();
    if (!emailValue || !password) {
      notifyAuthMessage('Sign In', 'Enter both email and password.');
      return;
    }
    if (!isValidEmail(emailValue)) {
      setEmailError('Enter a valid email address.');
      notifyAuthMessage('Sign In', 'Enter a valid email address.');
      return;
    }
    setEmailError('');

    setSignInLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: emailValue,
      password,
    });
    setSignInLoading(false);

    if (error) {
      notifyAuthError('Sign In', error);
      return;
    }
    router.replace('/alarm');
  };

  const onEmailChange = (text: string) => {
    setEmail(sanitizeEmailInput(text));
    if (emailError) {
      setEmailError('');
    }
  };

  const onEmailBlur = () => {
    const v = email.trim().toLowerCase();
    if (!v) {
      setEmailError('');
      return;
    }
    setEmailError(isValidEmail(v) ? '' : 'Enter a valid email address.');
  };

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <LinearGradient
        colors={['rgba(6,182,212,0.18)', 'transparent']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.glowBg}
      />

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.logoWrap}>
          <View style={styles.logoIcon}>
            <Text style={styles.logoRing}>◌</Text>
            <Text style={styles.logoRingDelayed}>◌</Text>
            <Text style={styles.logoEmoji}>{signInIcons.alarm}</Text>
          </View>
          <Text style={styles.logoName}>
            Rip<Text style={styles.logoNameAccent}>ple</Text>
          </Text>
          <Text style={styles.logoTagline}>Repeat alarms, done right</Text>
        </View>

        <Text style={styles.title}>Welcome back</Text>
        <Text style={styles.subtitle}>Sign in to sync your alarms across devices</Text>

        <SignInField
          label="Email"
          value={email}
          onChangeText={onEmailChange}
          onBlur={onEmailBlur}
          variant="email"
          errorMessage={emailError}
          rightIcon={signInIcons.email}
          focused
        />
        <SignInField
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Enter password"
          rightText={showPassword ? 'SHOW' : 'HIDE'}
          secure={showPassword}
          onToggleSecure={() => setShowPassword((v) => !v)}
        />

        <View style={styles.forgotRow}>
          <Pressable>
            <Text style={styles.forgotLink}>Forgot password?</Text>
          </Pressable>
        </View>

        <Pressable style={styles.ctaBtn} onPress={() => void onSignInPress()}>
          <Text style={styles.ctaText}>{signInLoading ? 'Signing in...' : `Sign In ${signInIcons.arrow}`}</Text>
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or continue with</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialRow}>
          <SocialAuthButton icon={signInIcons.apple} label="Apple" />
          <SocialAuthButton
            icon={signInIcons.google}
            label={googleLoading ? 'Google...' : 'Google'}
            onPress={onGooglePress}
          />
        </View>

        <Text style={styles.footer}>
          Don&apos;t have an account?{' '}
          <Text style={styles.footerLink} onPress={() => router.push('/signup')}>
            Sign up
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
    top: 60,
    left: '50%',
    marginLeft: -140,
    width: 280,
    height: 200,
    borderRadius: 140,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  logoWrap: {
    alignItems: 'center',
    paddingVertical: 24,
    marginBottom: 4,
  },
  logoIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: alarmTheme.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: alarmTheme.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 4,
  },
  logoRing: {
    position: 'absolute',
    color: 'rgba(6,182,212,0.35)',
    fontSize: 44,
  },
  logoRingDelayed: {
    position: 'absolute',
    color: 'rgba(6,182,212,0.22)',
    fontSize: 54,
  },
  logoEmoji: {
    fontSize: 28,
  },
  logoName: {
    color: alarmTheme.text,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  logoNameAccent: {
    color: alarmTheme.accentBright,
  },
  logoTagline: {
    color: alarmTheme.muted,
    fontSize: 12,
    marginTop: 3,
    fontFamily: 'monospace',
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
    marginBottom: 24,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: -8,
    marginBottom: 20,
  },
  forgotLink: {
    color: alarmTheme.accentBright,
    fontSize: 12,
  },
  ctaBtn: {
    width: '100%',
    backgroundColor: alarmTheme.accent,
    borderRadius: 14,
    padding: 15,
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
    flexDirection: 'row',
    width: '100%',
    gap: 10,
    marginBottom: 24,
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
