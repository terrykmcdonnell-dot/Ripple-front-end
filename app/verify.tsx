import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { verifyIcons } from '@/assets/icons/verify-icons';
import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { FullScreenLoadingOverlay } from '@/components/ui/FullScreenLoadingOverlay';
import { OtpVerificationCode } from '@/components/verify/OtpVerificationCode';
import { VerifyEnvelopeHero } from '@/components/verify/VerifyEnvelopeHero';
import { VerifyHelpNote } from '@/components/verify/VerifyHelpNote';
import { useRedirectIfAuthenticated } from '@/hooks/use-redirect-if-authenticated';
import { notifyAuthError, notifyAuthMessage } from '@/lib/auth-notify';
import { clearPendingSignUp, getPendingSignUp } from '@/lib/pending-signup';
import { syncUserProfileToTable } from '@/lib/sync-user-profile';
import { supabase } from '@/lib/supabase';

const OTP_LENGTH = 6;
const CODE_TTL_SECONDS = 10 * 60;

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: alarmTheme.bg,
    },
    glowBg: {
      position: 'absolute',
      top: 100,
      left: '50%',
      marginLeft: -150,
      width: 300,
      height: 220,
      borderRadius: 150,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingTop: 60,
      paddingHorizontal: 24,
      paddingBottom: 36,
      alignItems: 'center',
    },
    topRow: {
      width: '100%',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 36,
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
    backIcon: {
      color: alarmTheme.muted,
      fontSize: 14,
      marginTop: -1,
    },
    topLogo: {
      color: alarmTheme.text,
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: -0.32,
    },
    topLogoAccent: {
      color: alarmTheme.accentBright,
    },
    title: {
      color: alarmTheme.text,
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.48,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 13,
      color: alarmTheme.muted,
      textAlign: 'center',
      lineHeight: 21,
      marginBottom: 8,
    },
    emailHighlight: {
      fontSize: 13,
      color: alarmTheme.accentBright,
      fontWeight: '600',
      fontFamily: 'monospace',
      marginBottom: 32,
    },
    expiryText: {
      fontSize: 11,
      color: alarmTheme.muted,
      fontFamily: 'monospace',
      textAlign: 'center',
      marginBottom: 28,
    },
    expiryValue: {
      color: alarmTheme.accentBright,
    },
    ctaBtn: {
      width: '100%',
      backgroundColor: alarmTheme.accent,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      marginBottom: 16,
      shadowColor: alarmTheme.accent,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 12,
      elevation: 4,
    },
    ctaDisabled: {
      opacity: 0.7,
    },
    ctaText: {
      color: '#ffffff',
      fontSize: 15,
      fontWeight: '700',
    },
    resendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginBottom: 24,
    },
    resendText: {
      fontSize: 13,
      color: alarmTheme.muted,
    },
    resendLink: {
      fontSize: 13,
      color: alarmTheme.accentBright,
      fontWeight: '600',
    },
  });
}

export default function VerifyScreen() {
  useRedirectIfAuthenticated();
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const emailParam = Array.isArray(params.email) ? params.email[0] : params.email;
  const [emailDisplay, setEmailDisplay] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(CODE_TTL_SECONDS);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const fromParam = typeof emailParam === 'string' ? emailParam.trim().toLowerCase() : '';
      const pending = await getPendingSignUp();
      const resolved = fromParam || pending?.email || '';

      if (!resolved) {
        notifyAuthMessage('Verify', 'No email to verify. Start from sign up.', [
          { text: 'OK', onPress: () => router.replace('/signup') },
        ]);
        return;
      }

      if (pending && pending.email !== resolved) {
        notifyAuthMessage('Verify', 'Something does not match. Please sign up again.');
        await clearPendingSignUp();
        router.replace('/signup');
        return;
      }

      setEmailDisplay(resolved);
    };
    void load();
  }, [emailParam, router]);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((s) => (s <= 0 ? 0 : s - 1));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const timeLabel = useMemo(() => {
    const mins = Math.floor(secondsLeft / 60)
      .toString()
      .padStart(2, '0');
    const secs = (secondsLeft % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }, [secondsLeft]);

  const onVerify = useCallback(async () => {
    const email = emailDisplay.trim().toLowerCase();
    if (!email) {
      return;
    }
    if (otpCode.length !== OTP_LENGTH) {
      notifyAuthMessage('Verify', `Enter the ${OTP_LENGTH}-digit code from your email.`);
      return;
    }

    setVerifyLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'signup',
      });

      if (error) {
        // Clear boxes — Supabase invalidates the OTP after a failed attempt,
        // so the same code will not work again. Prompt the user to resend.
        setOtpCode('');
        notifyAuthError('Verify', error);
        return;
      }

      if (!data.session) {
        setOtpCode('');
        notifyAuthMessage('Verify', 'Verification did not finish. Try again or tap Resend code.');
        return;
      }

      const pending = await getPendingSignUp();
      if (!pending || pending.email !== email) {
        // No pending data — sign out the newly-created session so the user
        // is not silently "logged in" with an incomplete profile.
        await supabase.auth.signOut();
        await clearPendingSignUp();
        notifyAuthMessage('Verify', 'Your sign-up data is missing. Please create an account again.');
        router.replace('/signup');
        return;
      }

      // Do NOT call supabase.auth.updateUser({ password }) here.
      //
      // The password was already set when supabase.auth.signUp() was called.
      // Calling updateUser again is redundant and re-runs Supabase's server-side
      // password strength check (zxcvbn) which can reject passwords that signUp
      // accepted — e.g. "123123123123" scores as weak despite being 12 chars.
      // This caused a "Choose a stronger password" error on the verify screen
      // even when the user's code and password were both correct.

      const { error: profileError } = await syncUserProfileToTable({
        name: pending.name,
        email: pending.email,
        password: pending.password,
      });

      if (profileError) {
        // Sign out so the session does not persist — without a profile the user
        // would be silently redirected to /alarm on the next app launch even
        // though their account setup did not complete.
        await supabase.auth.signOut();
        await clearPendingSignUp();
        notifyAuthError('Verify', profileError);
        return;
      }

      await clearPendingSignUp();
      router.replace('/alarm');
    } finally {
      setVerifyLoading(false);
    }
  }, [emailDisplay, otpCode, router]);

  const onResend = useCallback(async () => {
    const email = emailDisplay.trim().toLowerCase();
    if (!email) {
      return;
    }
    setResendLoading(true);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
    });
    setResendLoading(false);

    if (error) {
      notifyAuthError('Resend code', error);
      return;
    }

    setOtpCode('');
    setSecondsLeft(CODE_TTL_SECONDS);
    notifyAuthMessage('Resend code', 'If this email is waiting for verification, a new code was sent.');
  }, [emailDisplay]);

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
        <View style={styles.topRow}>
          <Pressable
            style={styles.backBtn}
            onPress={() => {
              router.back();
            }}>
            <Text style={styles.backIcon}>{verifyIcons.back}</Text>
          </Pressable>
          <Text style={styles.topLogo}>
            Rip<Text style={styles.topLogoAccent}>ple</Text>
          </Text>
        </View>

        <VerifyEnvelopeHero accent={alarmTheme.accent} accentBannerBorder={alarmTheme.accentBannerBorder} />

        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>We sent a 6-digit code to</Text>
        <Text style={styles.emailHighlight}>{emailDisplay || '—'}</Text>

        <OtpVerificationCode value={otpCode} onChangeCode={setOtpCode} />

        <Text style={styles.expiryText}>
          Code expires in <Text style={styles.expiryValue}>{timeLabel}</Text>
        </Text>

        <Pressable style={[styles.ctaBtn, verifyLoading ? styles.ctaDisabled : null]} onPress={() => void onVerify()} disabled={verifyLoading}>
          <Text style={styles.ctaText}>{verifyLoading ? 'Verifying...' : `Verify Email ${verifyIcons.arrow}`}</Text>
        </Pressable>

        <View style={styles.resendRow}>
          <Text style={styles.resendText}>Didn&apos;t receive it?</Text>
          <Pressable onPress={() => void onResend()} disabled={resendLoading}>
            <Text style={styles.resendLink}>{resendLoading ? 'Sending...' : 'Resend code'}</Text>
          </Pressable>
        </View>

        <VerifyHelpNote />
      </ScrollView>
      <FullScreenLoadingOverlay visible={verifyLoading || resendLoading} />
    </View>
  );
}
