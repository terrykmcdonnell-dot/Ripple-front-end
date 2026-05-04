import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { verifyIcons } from '@/assets/icons/verify-icons';
import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { FullScreenLoadingOverlay } from '@/components/ui/FullScreenLoadingOverlay';
import { OtpVerificationCode } from '@/components/verify/OtpVerificationCode';
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
      borderColor: alarmTheme.accentBannerBorder,
    },
    envRing1: {
      transform: [{ scale: 1 }],
      opacity: 0.62,
    },
    envRing2: {
      transform: [{ scale: 1.32 }],
      opacity: 0.34,
    },
    envRing3: {
      transform: [{ scale: 1.62 }],
      opacity: 0.18,
    },
    envCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: alarmTheme.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: alarmTheme.accent,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 24,
      elevation: 4,
    },
    envEmoji: {
      fontSize: 30,
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
      // Matches signInWithOtp — user is created/confirmed when this succeeds (not on the sign-up screen).
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'email',
      });

      if (error) {
        notifyAuthError('Verify', error);
        return;
      }

      if (!data.session) {
        notifyAuthMessage('Verify', 'Verification did not finish. Try again or tap Resend code.');
        return;
      }

      const pending = await getPendingSignUp();
      if (!pending || pending.email !== email) {
        notifyAuthMessage('Verify', 'Your sign-up data is missing. Please create an account again.');
        await clearPendingSignUp();
        router.replace('/signup');
        return;
      }

      const { error: pwError } = await supabase.auth.updateUser({ password: pending.password });
      if (pwError) {
        notifyAuthError('Verify', pwError);
        return;
      }

      const { error: profileError } = await syncUserProfileToTable({
        name: pending.name,
        email: pending.email,
        password: pending.password,
      });

      if (profileError) {
        notifyAuthError('Verify', profileError);
        return;
      }

      await clearPendingSignUp();
      await supabase.auth.signOut();
      router.replace('/signin');
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

        <View style={styles.envelopeWrap}>
          <View style={[styles.envRing, styles.envRing1]} />
          <View style={[styles.envRing, styles.envRing2]} />
          <View style={[styles.envRing, styles.envRing3]} />
          <View style={styles.envCircle}>
            <Text style={styles.envEmoji}>{verifyIcons.envelope}</Text>
          </View>
        </View>

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
