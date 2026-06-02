import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { signUpIcons } from '@/assets/icons/signup-icons';
import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { SignInField } from '@/components/signin/SignInField';
import { SocialAuthButton } from '@/components/signin/SocialAuthButton';
import { PasswordStrength } from '@/components/signup/PasswordStrength';
import { TermsAgreement } from '@/components/signup/TermsAgreement';
import { TopBrandRow } from '@/components/signup/TopBrandRow';
import { ValueBanner } from '@/components/signup/ValueBanner';
import { FullScreenLoadingOverlay } from '@/components/ui/FullScreenLoadingOverlay';
import { useAppleAuthWithSupabase } from '@/hooks/use-apple-auth';
import { useGoogleAuthWithSupabase } from '@/hooks/use-google-auth';
import { useRedirectIfAuthenticated } from '@/hooks/use-redirect-if-authenticated';
import { notifyAuthError, notifyAuthMessage } from '@/lib/auth-notify';
import { EMAIL_ALREADY_REGISTERED_MESSAGE, startEmailSignUp } from '@/lib/auth-sign-up';
import { isValidEmail, isValidPassword, sanitizeEmailInput } from '@/lib/auth-validation';
import { savePendingSignUp } from '@/lib/pending-signup';
import { syncUserProfileToTable } from '@/lib/sync-user-profile';
import { supabase } from '@/lib/supabase';

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
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
}

export default function SignUpScreen() {
  useRedirectIfAuthenticated();
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);
  const router = useRouter();
  const { appleLoading, onApplePress: startAppleOAuth } = useAppleAuthWithSupabase();
  const { googleLoading, onGooglePress: startGoogleOAuth } = useGoogleAuthWithSupabase();

  const onGooglePress = () => {
    if (!termsChecked) {
      notifyAuthMessage('Sign Up', 'Agree to the terms and privacy policy to continue.');
      return;
    }
    startGoogleOAuth();
  };

  const onApplePress = () => {
    if (!termsChecked) {
      notifyAuthMessage('Sign Up', 'Agree to the terms and privacy policy to continue.');
      return;
    }
    startAppleOAuth();
  };
  const [showPassword, setShowPassword] = useState(true);
  const [termsChecked, setTermsChecked] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onCreateAccount = async () => {
    const nameValue = fullName.trim();
    const emailValue = email.trim().toLowerCase();

    if (!nameValue || !emailValue || !password) {
      notifyAuthMessage('Sign Up', 'Fill in your name, email, and password.');
      return;
    }
    if (!isValidEmail(emailValue)) {
      setEmailError('Enter a valid email address.');
      notifyAuthMessage('Sign Up', 'Enter a valid email address.');
      return;
    }
    setEmailError('');
    if (!isValidPassword(password)) {
      notifyAuthMessage('Sign Up', 'Password must be at least 6 characters.');
      return;
    }
    if (!termsChecked) {
      notifyAuthMessage('Sign Up', 'Agree to the terms and privacy policy to continue.');
      return;
    }

    setIsSubmitting(true);

    const result = await startEmailSignUp({
      email: emailValue,
      password,
      name: nameValue,
    });

    if (result.kind === 'error') {
      setIsSubmitting(false);
      notifyAuthError('Sign Up', result.error);
      return;
    }

    if (result.kind === 'existing_user') {
      setIsSubmitting(false);
      setEmailError(EMAIL_ALREADY_REGISTERED_MESSAGE);
      notifyAuthMessage('Sign Up', EMAIL_ALREADY_REGISTERED_MESSAGE);
      return;
    }

    if (result.kind === 'session') {
      // Do NOT call supabase.auth.updateUser({ password }) here.
      // signUp() already set the password. Calling updateUser again re-runs
      // Supabase's server-side zxcvbn strength check which can reject passwords
      // that signUp accepted, showing a spurious "weak password" error.
      const { error: profileError } = await syncUserProfileToTable({
        name: nameValue,
        email: emailValue,
        password,
      });
      setIsSubmitting(false);
      if (profileError) {
        // Sign out so the session does not persist — without a profile the user
        // would be silently redirected to /alarm on the next app launch.
        await supabase.auth.signOut();
        notifyAuthError('Sign Up', profileError);
        return;
      }
      router.replace('/alarm');
      return;
    }

    await savePendingSignUp({ name: nameValue, email: emailValue, password });
    setIsSubmitting(false);
    router.push({ pathname: '/verify', params: { email: emailValue } });
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
          onChangeText={onEmailChange}
          onBlur={onEmailBlur}
          variant="email"
          errorMessage={emailError}
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
          <PasswordStrength password={password} />
        </View>

        <TermsAgreement checked={termsChecked} onToggle={() => setTermsChecked((v) => !v)} />

        <Pressable style={styles.ctaBtn} onPress={() => void onCreateAccount()}>
          <Text style={styles.ctaText}>{isSubmitting ? 'Creating...' : `Create Account ${signUpIcons.arrow}`}</Text>
        </Pressable>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or sign up with</Text>
          <View style={styles.dividerLine} />
        </View>

        <View style={styles.socialRow}>
          <SocialAuthButton
            provider="apple"
            label={appleLoading ? 'Apple…' : 'Apple'}
            onPress={onApplePress}
          />
          <SocialAuthButton
            provider="google"
            label={googleLoading ? 'Google...' : 'Google'}
            onPress={onGooglePress}
          />
        </View>

        <Text style={styles.footer}>
          Already have an account?{' '}
          <Text style={styles.footerLink} onPress={() => router.push('/signin')}>
            Sign in
          </Text>
        </Text>
      </ScrollView>
      <FullScreenLoadingOverlay visible={isSubmitting || googleLoading || appleLoading} />
    </View>
  );
}
