import { Pressable, StyleSheet, Text, View } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';
import { signUpIcons } from '@/assets/icons/signup-icons';

type TermsAgreementProps = {
  checked: boolean;
  onToggle: () => void;
};

export function TermsAgreement({ checked, onToggle }: TermsAgreementProps) {
  return (
    <View style={styles.row}>
      <Pressable style={[styles.checkbox, checked ? styles.checkboxChecked : null]} onPress={onToggle}>
        {checked ? <Text style={styles.checkText}>{signUpIcons.check}</Text> : null}
      </Pressable>
      <Text style={styles.text}>
        I agree to the <Text style={styles.link}>Terms of Service</Text> and{' '}
        <Text style={styles.link}>Privacy Policy</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 4,
    marginBottom: 18,
    width: '100%',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 6,
    backgroundColor: alarmTheme.surface2,
    borderWidth: 1,
    borderColor: alarmTheme.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxChecked: {
    backgroundColor: alarmTheme.accentDim,
    borderColor: alarmTheme.accent,
  },
  checkText: {
    color: alarmTheme.accentBright,
    fontSize: 11,
  },
  text: {
    flex: 1,
    color: alarmTheme.muted,
    fontSize: 12,
    lineHeight: 18,
  },
  link: {
    color: alarmTheme.accentBright,
  },
});
