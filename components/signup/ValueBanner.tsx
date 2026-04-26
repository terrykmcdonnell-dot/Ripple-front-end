import { StyleSheet, Text, View } from 'react-native';

import { alarmTheme } from '@/components/alarms/theme';
import { signUpIcons } from '@/assets/icons/signup-icons';

export function ValueBanner() {
  return (
    <View style={styles.banner}>
      <Text style={styles.icon}>{signUpIcons.cloud}</Text>
      <Text style={styles.text}>
        <Text style={styles.strong}>Free account includes cloud sync.</Text> Upgrade to Pro for unlimited alarms
        and widgets.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: alarmTheme.accentDim,
    borderWidth: 1,
    borderColor: 'rgba(6,182,212,0.25)',
    borderRadius: 13,
    paddingVertical: 11,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 20,
    width: '100%',
  },
  icon: {
    fontSize: 20,
  },
  text: {
    flex: 1,
    color: alarmTheme.accentBright,
    fontSize: 12,
    lineHeight: 18,
  },
  strong: {
    fontWeight: '700',
  },
});
