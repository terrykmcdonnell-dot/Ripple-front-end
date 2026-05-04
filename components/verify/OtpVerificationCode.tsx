import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { type AlarmThemePalette, useAlarmTheme } from '@/components/alarms/theme';

import { VerifyOtpBox } from './VerifyOtpBox';

const OTP_LENGTH = 6;

type OtpVerificationCodeProps = {
  /** Controlled value (digits only, max 6). Omit for internal state. */
  value?: string;
  onChangeCode?: (code: string) => void;
};

function createStyles(alarmTheme: AlarmThemePalette) {
  return StyleSheet.create({
    wrap: {
      width: '100%',
      marginBottom: 10,
    },
    label: {
      fontFamily: 'monospace',
      fontSize: 10,
      letterSpacing: 1.4,
      color: alarmTheme.muted,
      marginBottom: 12,
    },
    row: {
      width: '100%',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    boxSlot: {
      flex: 1,
      minWidth: 0,
      maxWidth: 52,
      alignItems: 'center',
    },
    hiddenInput: {
      position: 'absolute',
      width: 1,
      height: 1,
      opacity: 0,
      overflow: 'hidden',
    },
  });
}

export function OtpVerificationCode({ value: controlledValue, onChangeCode }: OtpVerificationCodeProps) {
  const alarmTheme = useAlarmTheme();
  const styles = useMemo(() => createStyles(alarmTheme), [alarmTheme]);
  const inputRef = useRef<TextInput>(null);
  const [internal, setInternal] = useState('');
  const isControlled = controlledValue !== undefined;
  const code = isControlled ? controlledValue : internal;

  const setCode = useCallback(
    (next: string) => {
      const digits = next.replace(/\D/g, '').slice(0, OTP_LENGTH);
      if (!isControlled) {
        setInternal(digits);
      }
      onChangeCode?.(digits);
    },
    [isControlled, onChangeCode]
  );

  const digits = useMemo(() => {
    const chars: string[] = [];
    for (let i = 0; i < OTP_LENGTH; i += 1) {
      chars.push(code[i] ?? '');
    }
    return chars;
  }, [code]);

  const activeIndex = useMemo(() => {
    if (code.length >= OTP_LENGTH) {
      return -1;
    }
    return code.length;
  }, [code.length]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>ENTER VERIFICATION CODE</Text>

      <Pressable style={styles.row} onPress={() => inputRef.current?.focus()}>
        {digits.map((digit, idx) => (
          <View key={`otp-${idx}`} style={styles.boxSlot}>
            <VerifyOtpBox value={digit} active={idx === activeIndex} />
          </View>
        ))}
      </Pressable>

      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={setCode}
        keyboardType="number-pad"
        maxLength={OTP_LENGTH}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        importantForAutofill="yes"
        caretHidden
        style={styles.hiddenInput}
      />
    </View>
  );
}
