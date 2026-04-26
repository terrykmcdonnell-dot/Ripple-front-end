import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';

type SignInFieldProps = {
  label: string;
  value: string;
  placeholder?: string;
  rightText?: string;
  rightIcon?: string;
  focused?: boolean;
  secure?: boolean;
  onToggleSecure?: () => void;
  onChangeText?: (text: string) => void;
  keyboardType?: 'default' | 'email-address';
};

export function SignInField({
  label,
  value,
  placeholder,
  rightText,
  rightIcon,
  focused,
  secure,
  onToggleSecure,
  onChangeText,
  keyboardType = 'default',
}: SignInFieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, focused ? styles.inputFocused : null]}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={alarmTheme.muted}
          secureTextEntry={secure}
          keyboardType={keyboardType}
          autoCapitalize="none"
          style={[styles.inputText, secure ? styles.secureText : null]}
        />
        {rightText ? (
          <Pressable onPress={onToggleSecure}>
            <Text style={styles.rightText}>{rightText}</Text>
          </Pressable>
        ) : rightIcon ? (
          <Text style={styles.rightIcon}>{rightIcon}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    marginBottom: 14,
    width: '100%',
  },
  label: {
    fontSize: 10,
    fontFamily: 'monospace',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    color: alarmTheme.muted,
    marginBottom: 7,
  },
  inputWrap: {
    width: '100%',
    backgroundColor: alarmTheme.surface2,
    borderWidth: 1,
    borderColor: alarmTheme.border,
    borderRadius: 13,
    paddingVertical: 13,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputFocused: {
    borderColor: alarmTheme.accent,
    shadowColor: alarmTheme.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 2,
  },
  inputText: {
    flex: 1,
    color: alarmTheme.text,
    fontSize: 14,
    padding: 0,
    borderWidth: 0,
    backgroundColor: 'transparent',
    outlineStyle: 'none',
  },
  secureText: {
    letterSpacing: 2.8,
  },
  rightText: {
    color: alarmTheme.muted,
    fontSize: 13,
    fontFamily: 'monospace',
    letterSpacing: 0.5,
  },
  rightIcon: {
    color: alarmTheme.muted,
    fontSize: 16,
  },
});
