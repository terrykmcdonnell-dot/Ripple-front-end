import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { verifyIcons } from '@/assets/icons/verify-icons';
import { signInIcons } from '@/assets/icons/signin-icons';
import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';
import { SignInField } from '@/components/signin/SignInField';
import { PasswordStrength } from '@/components/signup/PasswordStrength';
import { useAppToast } from '@/components/ui/AppToastProvider';
import { FullScreenLoadingOverlay } from '@/components/ui/FullScreenLoadingOverlay';
import { OtpVerificationCode } from '@/components/verify/OtpVerificationCode';
import { getAuthErrorDisplayText } from '@/lib/auth-notify';
import { isValidPassword } from '@/lib/auth-validation';
import { sendPasswordResetOtp } from '@/lib/auth-password-reset-otp';
import { syncPasswordToUsersTable } from '@/lib/sync-user-profile';
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
      top: 80,
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
      paddingTop: 52,
      paddingHorizontal: 24,
      paddingBottom: 36,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 22,
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
      marginBottom: 6,
    },
    emailHighlight: {
      fontSize: 13,
      color: alarmTheme.accentBright,
      fontWeight: '600',
      fontFamily: 'monospace',
      marginBottom: 18,
    },
    expiryText: {
      fontSize: 11,
      color: alarmTheme.muted,
      fontFamily: 'monospace',
      marginBottom: 16,
    },
    expiryValue: {
      color: alarmTheme.accentBright,
    },
    pwdWrap: {
      marginBottom: 10,
    },
    ctaBtn: {
      width: '100%',
      backgroundColor: alarmTheme.accent,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      marginTop: 14,
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
    resendRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      marginTop: 18,
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

export default function ResetPasswordScreen() {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);
  const router = useRouter();
  const { showToast } = useAppToast();
  const params = useLocalSearchParams<{ email?: string | string[] }>();
  const emailParam = Array.isArray(params.email) ? params.email[0] : params.email;

  const [emailDisplay, setEmailDisplay] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(true);
  const [showConfirm, setShowConfirm] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(CODE_TTL_SECONDS);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  useEffect(() => {
    const e = typeof emailParam === 'string' ? emailParam.trim().toLowerCase() : '';
    if (!e) {
      router.replace('/forgot-password');
      return;
    }
    setEmailDisplay(e);
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

  const onResend = useCallback(async () => {
    const email = emailDisplay.trim().toLowerCase();
    if (!email) {
      return;
    }
    setResendLoading(true);
    const { error } = await sendPasswordResetOtp(email);
    setResendLoading(false);

    if (error) {
      showToast(`Resend · ${getAuthErrorDisplayText(error)}`);
      return;
    }

    setSecondsLeft(CODE_TTL_SECONDS);
    showToast('If this email is registered, a new code was sent.');
  }, [emailDisplay, showToast]);

  const onSubmit = useCallback(async () => {
    const email = emailDisplay.trim().toLowerCase();
    if (!email) {
      return;
    }
    if (otpCode.length !== OTP_LENGTH) {
      showToast(`Enter the ${OTP_LENGTH}-digit code from your email.`);
      return;
    }
    if (!isValidPassword(password)) {
      showToast('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      showToast('Passwords do not match.');
      return;
    }

    setSubmitLoading(true);
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token: otpCode.trim(),
      type: 'recovery',
    });

    if (error || !data.session) {
      setSubmitLoading(false);
      showToast(`Reset password · ${getAuthErrorDisplayText(error ?? new Error('Verification did not complete.'))}`);
      return;
    }

    const { error: pwError } = await supabase.auth.updateUser({ password });
    if (pwError) {
      await supabase.auth.signOut();
      setSubmitLoading(false);
      showToast(`Reset password · ${getAuthErrorDisplayText(pwError)}`);
      return;
    }

    const { error: syncErr } = await syncPasswordToUsersTable(email, password);
    setSubmitLoading(false);

    if (syncErr) {
      showToast(
        'Password saved · Profile sync had an issue—you can retry from Settings later.',
      );
    }

    router.replace('/alarm');
  }, [confirmPassword, emailDisplay, otpCode, password, router, showToast]);

  if (!emailDisplay) {
    return null;
  }

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
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back">
            <Text style={styles.backIcon}>{verifyIcons.back}</Text>
          </Pressable>
        </View>

        <Text style={styles.title}>Choose new password</Text>
        <Text style={styles.subtitle}>Enter the code from your email, then set a new password.</Text>
        <Text style={styles.emailHighlight}>{emailDisplay}</Text>

        <OtpVerificationCode value={otpCode} onChangeCode={setOtpCode} />

        <Text style={styles.expiryText}>
          Code expires in <Text style={styles.expiryValue}>{timeLabel}</Text> · Tap resend if it expired
        </Text>

        <View style={styles.pwdWrap}>
          <SignInField
            label="New password"
            value={password}
            onChangeText={setPassword}
            placeholder="At least 6 characters"
            rightText={showPassword ? 'SHOW' : 'HIDE'}
            secure={showPassword}
            onToggleSecure={() => setShowPassword((v) => !v)}
          />
          <PasswordStrength password={password} />
        </View>

        <SignInField
          label="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Re-enter password"
          rightText={showConfirm ? 'SHOW' : 'HIDE'}
          secure={showConfirm}
          onToggleSecure={() => setShowConfirm((v) => !v)}
        />

        <Pressable
          style={[styles.ctaBtn, submitLoading && styles.ctaDisabled]}
          disabled={submitLoading}
          onPress={() => void onSubmit()}>
          <Text style={styles.ctaText}>{submitLoading ? 'Saving…' : `Update password ${signInIcons.arrow}`}</Text>
        </Pressable>

        <View style={styles.resendRow}>
          <Text style={styles.resendText}>Need a new code?</Text>
          <Pressable onPress={() => void onResend()} disabled={resendLoading}>
            <Text style={styles.resendLink}>{resendLoading ? 'Sending…' : 'Resend'}</Text>
          </Pressable>
        </View>
      </ScrollView>
      <FullScreenLoadingOverlay visible={submitLoading || resendLoading} />
    </View>
  );
}
