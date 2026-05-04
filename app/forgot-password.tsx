import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { verifyIcons } from '@/assets/icons/verify-icons';
import { signInIcons } from '@/assets/icons/signin-icons';
import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { SignInField } from '@/components/signin/SignInField';
import { FullScreenLoadingOverlay } from '@/components/ui/FullScreenLoadingOverlay';
import { useRedirectIfAuthenticated } from '@/hooks/use-redirect-if-authenticated';
import { notifyAuthError, notifyAuthMessage } from '@/lib/auth-notify';
import { isValidEmail, sanitizeEmailInput } from '@/lib/auth-validation';
import { sendPasswordResetOtp } from '@/lib/auth-password-reset-otp';

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
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
      paddingTop: 52,
      paddingHorizontal: 24,
      paddingBottom: 32,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 28,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: 11,
      backgroundColor: alarmTheme.surface2,
      borderWidth: 1,
      borderColor: alarmTheme.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backIcon: {
      color: alarmTheme.muted,
      fontSize: 14,
      marginTop: -1,
    },
    title: {
      color: alarmTheme.text,
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.4,
      marginBottom: 8,
    },
    subtitle: {
      color: alarmTheme.muted,
      fontSize: 13,
      lineHeight: 20,
      marginBottom: 22,
    },
    ctaBtn: {
      width: '100%',
      backgroundColor: alarmTheme.accent,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      marginTop: 8,
      shadowColor: alarmTheme.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 4,
    },
    ctaDisabled: {
      opacity: 0.65,
    },
    ctaText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '700',
    },
  });
}

export default function ForgotPasswordScreen() {
  useRedirectIfAuthenticated();
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [loading, setLoading] = useState(false);

  const onEmailChange = (text: string) => {
    setEmail(sanitizeEmailInput(text));
    if (emailError) {
      setEmailError('');
    }
  };

  const onSubmit = async () => {
    const emailValue = email.trim().toLowerCase();
    if (!emailValue) {
      notifyAuthMessage('Reset password', 'Enter your email address.');
      return;
    }
    if (!isValidEmail(emailValue)) {
      setEmailError('Enter a valid email address.');
      notifyAuthMessage('Reset password', 'Enter a valid email address.');
      return;
    }
    setEmailError('');

    setLoading(true);
    const { error } = await sendPasswordResetOtp(emailValue);
    setLoading(false);

    if (error) {
      notifyAuthError('Reset password', error);
      return;
    }

    notifyAuthMessage(
      'Check your email',
      'If this address is registered, you will receive a 6-digit code shortly. Enter it on the next screen with your new password.',
    );
    router.push({ pathname: '/reset-password', params: { email: emailValue } });
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
        <View style={styles.topRow}>
          <Pressable style={styles.backBtn} onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Go back">
            <Text style={styles.backIcon}>{verifyIcons.back}</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>Forgot password?</Text>
        <Text style={styles.subtitle}>
          We&apos;ll email a one-time code if this address has an account. You&apos;ll choose a new password after entering the code.
        </Text>

        <SignInField
          label="Email"
          value={email}
          onChangeText={onEmailChange}
          variant="email"
          errorMessage={emailError}
          rightIcon={signInIcons.email}
          focused
        />

        <Pressable
          style={[styles.ctaBtn, loading && styles.ctaDisabled]}
          disabled={loading}
          onPress={() => void onSubmit()}>
          <Text style={styles.ctaText}>{loading ? 'Sending…' : `Send code ${signInIcons.arrow}`}</Text>
        </Pressable>
      </ScrollView>
      <FullScreenLoadingOverlay visible={loading} />
    </View>
  );
}
