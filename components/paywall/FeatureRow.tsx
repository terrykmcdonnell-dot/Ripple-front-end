import { StyleSheet, Text, View } from 'react-native';

import { paywallIcons } from '@/assets/icons/paywall-icons';
import { alarmTheme } from '@/components/alarms/theme';

type FeatureRowProps = {
  text: string;
};

export function FeatureRow({ text }: FeatureRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.checkWrap}>
        <Text style={styles.check}>{paywallIcons.check}</Text>
      </View>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: alarmTheme.surface,
    borderWidth: 1,
    borderColor: alarmTheme.border,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 14,
  },
  checkWrap: {
    width: 24,
    height: 24,
    borderRadius: 7,
    backgroundColor: 'rgba(52,211,153,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  check: {
    color: alarmTheme.green,
    fontSize: 12,
    fontWeight: '700',
  },
  text: {
    color: alarmTheme.text,
    fontSize: 13,
    flex: 1,
  },
});
